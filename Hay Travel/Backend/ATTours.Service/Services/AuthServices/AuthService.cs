using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.Email;
using ATTours.BusinessServices.Security;
using ATTours.BusinessServices.Services.ValidationServices;
using ATTours.Common.DTO.Auth;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.ContextRepository.Helpers;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using ATTours.ContextRepository.RepositoryImplementation.Relational;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using AutoMapper;
using System.Net;

namespace ATTours.BusinessServices.Services.AuthServices
{
    // Единственная точка, где меняется состояние аутентификации: пароли, подтверждение
    // почты, блокировки и сессии. Доступ к БД — как у соседних сервисов (свой контекст
    // по строке из CommonSettings); DI отвечает только за коллабораторов (ADR 005).
    public class AuthService : RepositoryCoreBase<User, ATToursContextFactory>, IAuthService
    {
        private const int MaxFailedLoginAttempts = 5;
        private const int LockoutMinutes = 15;
        private const int EmailTokenLifetimeMinutes = 60;

        // Один и тот же текст для «письмо ушло» и «такого аккаунта нет» — иначе по ответу
        // перебирались бы зарегистрированные адреса.
        private const string GenericEmailSentMessage =
            "If the address is registered, we have sent an email with further instructions.";

        private const string PasswordChangedMessage = "Password has been changed.";
        private const string EmailVerifiedMessage = "Email has been verified.";

        private readonly IMapper mapper;
        private readonly IPasswordHasher passwordHasher;
        private readonly IJwtTokenService jwtTokenService;
        private readonly IEmailSender emailSender;

        public AuthService(IMapper mapper, IPasswordHasher passwordHasher, IJwtTokenService jwtTokenService, IEmailSender emailSender)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.mapper = mapper;
            this.passwordHasher = passwordHasher;
            this.jwtTokenService = jwtTokenService;
            this.emailSender = emailSender;
        }

        #region Repositories

        private IEntityRepository<User> UserRepository => EntityRepository;

        private IEntityRepository<UserToken>? userTokenRepository;
        private IEntityRepository<UserToken> UserTokenRepository => userTokenRepository ??= new EntityRepository<UserToken>(Context);

        private IEntityRepository<RefreshToken>? refreshTokenRepository;
        private IEntityRepository<RefreshToken> RefreshTokenRepository => refreshTokenRepository ??= new EntityRepository<RefreshToken>(Context);

        private IEntityRepository<UserRole>? userRoleRepository;
        private IEntityRepository<UserRole> UserRoleRepository => userRoleRepository ??= new EntityRepository<UserRole>(Context);

        #endregion

        #region Register / VerifyEmail

        public async Task<MessageResultModel> RegisterAsync(RegisterModel model, RequestContextModel requestContext, CancellationToken cancellationToken = default)
        {
            var validationService = new UserRegistrationValidationService([], Context);

            // Проверка email идёт первой и никогда не бросает: занятый адрес отвечает
            // тем же generic-сообщением, что и свободный.
            var existingUser = await validationService.FindByEmailAsync(model.Email, cancellationToken);
            if (existingUser is not null)
            {
                // Неверифицированному аккаунту переотправляем письмо — это закрывает
                // потребность в отдельном эндпоинте "resend".
                if (existingUser.IsEmailVerified)
                    return GenericEmailSent(null);

                var resentToken = await UpsertUserTokenAsync(existingUser, UserTokenType.EmailVerification, requestContext, cancellationToken);
                await emailSender.SendEmailVerificationAsync(existingUser.Email, existingUser.FirstName, resentToken, cancellationToken);
                return GenericEmailSent(resentToken);
            }

            var regularRole = await UserRoleRepository.AsQueryable()
                                                      .SingleOrDefaultAsync(role => role.Type == RoleType.Regular, cancellationToken)
                              ?? throw new ErrorModelException(GlobalErrorCode.RoleNotFound, HttpStatusCode.BadRequest,
                                  $"Default role '{RoleType.Regular}' is missing.");

            var user = mapper.Map<User>(model);
            user.RoleId = regularRole.Id;
            user.IsEmailVerified = false;
            user.FailedLoginAttempts = 0;
            user.LockedUntil = null;
            user.ForceToChangePass = false;
            user.Password = passwordHasher.Hash(model.Password);

            await new UserRegistrationValidationService([user], Context).ValidateEntitiesAsync();

            string verificationToken;
            using (var transaction = TransactionsHelper.CreateAsyncTransactionScope())
            {
                await UserRepository.AddAsync(user, cancellationToken);
                verificationToken = BuildUserToken(user, UserTokenType.EmailVerification, requestContext, out var tokenEntity);
                user.Tokens.Add(tokenEntity);

                await UserRepository.SaveChangesAsync(cancellationToken);
                transaction.Complete();
            }

            await emailSender.SendEmailVerificationAsync(user.Email, user.FirstName, verificationToken, cancellationToken);
            return GenericEmailSent(verificationToken);
        }

        public async Task<MessageResultModel> VerifyEmailAsync(VerifyEmailModel model, CancellationToken cancellationToken = default)
        {
            var token = await FindUsableTokenAsync(model.Token, UserTokenType.EmailVerification, cancellationToken)
                        ?? throw new ErrorModelException(GlobalErrorCode.VerificationTokenInvalid, HttpStatusCode.BadRequest,
                            "Verification token is invalid or expired.");

            using var transaction = TransactionsHelper.CreateAsyncTransactionScope();

            token.User.IsEmailVerified = true;
            token.UsedAtUtc = DateTime.UtcNow;
            await UserRepository.SaveChangesAsync(cancellationToken);

            transaction.Complete();

            return new MessageResultModel { Message = EmailVerifiedMessage };
        }

        #endregion

        #region Login / Refresh / Logout

        public async Task<LoginOutcome> LoginAsync(LoginModel model, RequestContextModel requestContext, CancellationToken cancellationToken = default)
        {
            var user = await FindUserByLoginAsync(model.UsernameOrEmail, cancellationToken);

            // Несуществующий пользователь не влияет ни на какие счётчики: иначе перебор
            // логинов создавал бы записи/нагрузку.
            if (user is null)
                throw InvalidCredentials();

            var now = DateTime.UtcNow;
            if (user.LockedUntil.HasValue && user.LockedUntil.Value > now)
                throw new ErrorModelException(GlobalErrorCode.AccountLocked, HttpStatusCode.Unauthorized,
                    "Account is temporarily locked. Try again later.");

            if (!passwordHasher.Verify(model.Password, user.Password))
            {
                await RegisterFailedAttemptAsync(user, cancellationToken);
                throw InvalidCredentials();
            }

            // Пароль верный — попытки обнуляются в любом случае, даже если вход дальше
            // не состоится из-за неподтверждённой почты.
            if (!user.IsEmailVerified)
            {
                user.FailedLoginAttempts = 0;
                await UserRepository.SaveChangesAsync(cancellationToken);
                throw new ErrorModelException(GlobalErrorCode.EmailNotVerified, HttpStatusCode.Forbidden,
                    "Email is not verified.");
            }

            user.FailedLoginAttempts = 0;
            user.LockedUntil = null;

            var refreshToken = jwtTokenService.CreateRefreshToken();
            await RefreshTokenRepository.AddAsync(new RefreshToken
            {
                UserId = user.Id,
                TokenHash = refreshToken.TokenHash,
                ExpiresAtUtc = refreshToken.ExpiresAtUtc,
                CreatedAtUtc = now,
                CreatedByIp = requestContext.IpAddress
            }, cancellationToken);

            // Один контекст -> один SaveChanges -> обнуление счётчика и выдача сессии
            // фиксируются вместе.
            await UserRepository.SaveChangesAsync(cancellationToken);

            var accessToken = jwtTokenService.CreateAccessToken(user);
            var result = new LoginResultModel
            {
                AccessToken = accessToken.AccessToken,
                ExpiresInSeconds = accessToken.ExpiresInSeconds,
                User = mapper.Map<UserInfoModel>(user),
                ForceChangePassword = user.ForceToChangePass
            };

            return new LoginOutcome(result, new IssuedRefreshToken(refreshToken.Token, refreshToken.ExpiresAtUtc));
        }

        public async Task<RefreshOutcome> RefreshAsync(string? refreshToken, RequestContextModel requestContext, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(refreshToken))
                throw RefreshTokenInvalid();

            var tokenHash = jwtTokenService.HashRefreshToken(refreshToken);
            var storedToken = await RefreshTokenRepository.AsQueryable()
                                                          .Include(x => x.User)
                                                          .ThenInclude(x => x.Role)
                                                          .SingleOrDefaultAsync(x => x.TokenHash == tokenHash, cancellationToken);

            if (storedToken is null)
                throw RefreshTokenInvalid();

            var now = DateTime.UtcNow;

            // Reuse-detection: предъявлен токен, который уже был отозван (значит, ротация
            // по нему прошла раньше) — считаем цепочку скомпрометированной и гасим все сессии.
            if (storedToken.RevokedAtUtc.HasValue)
            {
                await RevokeAllRefreshTokensAsync(storedToken.UserId, now, null, cancellationToken);
                await RefreshTokenRepository.SaveChangesAsync(cancellationToken);
                throw RefreshTokenInvalid();
            }

            if (storedToken.ExpiresAtUtc <= now)
                throw RefreshTokenInvalid();

            // Состояние учётки перепроверяется на каждой ротации: сессия живёт 14 дней и
            // переживает блокировку, поэтому без этой проверки заблокированный пользователь
            // продлевал бы себе доступ бесконечно, просто потому что залогинился раньше.
            // Порядок проверок тот же, что в LoginAsync: сперва блокировка, потом почта.
            var user = storedToken.User;

            if (user.LockedUntil.HasValue && user.LockedUntil.Value > now)
                throw await RevokeAndRejectAsync(storedToken, now, GlobalErrorCode.AccountLocked,
                    "Account is temporarily locked.", cancellationToken);

            if (!user.IsEmailVerified)
                throw await RevokeAndRejectAsync(storedToken, now, GlobalErrorCode.EmailNotVerified,
                    "Email is not verified.", cancellationToken);

            var rotatedToken = jwtTokenService.CreateRefreshToken();

            storedToken.RevokedAtUtc = now;
            storedToken.ReplacedByTokenHash = rotatedToken.TokenHash;

            await RefreshTokenRepository.AddAsync(new RefreshToken
            {
                UserId = storedToken.UserId,
                TokenHash = rotatedToken.TokenHash,
                ExpiresAtUtc = rotatedToken.ExpiresAtUtc,
                CreatedAtUtc = now,
                CreatedByIp = requestContext.IpAddress
            }, cancellationToken);

            await RefreshTokenRepository.SaveChangesAsync(cancellationToken);

            var accessToken = jwtTokenService.CreateAccessToken(storedToken.User);
            return new RefreshOutcome(accessToken, new IssuedRefreshToken(rotatedToken.Token, rotatedToken.ExpiresAtUtc));
        }

        public async Task LogoutAsync(string? refreshToken, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(refreshToken))
                return;

            var tokenHash = jwtTokenService.HashRefreshToken(refreshToken);
            var storedToken = await RefreshTokenRepository.AsQueryable()
                                                          .SingleOrDefaultAsync(x => x.TokenHash == tokenHash, cancellationToken);

            // Идемпотентность: неизвестный или уже отозванный токен — не ошибка,
            // конечное состояние («сессии нет») и так достигнуто.
            if (storedToken is null || storedToken.RevokedAtUtc.HasValue)
                return;

            storedToken.RevokedAtUtc = DateTime.UtcNow;
            await RefreshTokenRepository.SaveChangesAsync(cancellationToken);
        }

        #endregion

        #region Password recovery / change

        public async Task<MessageResultModel> ForgotPasswordAsync(ForgotPasswordModel model, RequestContextModel requestContext, CancellationToken cancellationToken = default)
        {
            var user = await UserRepository.AsQueryable()
                                           .SingleOrDefaultAsync(x => x.Email == model.Email, cancellationToken);

            // Ответ одинаков и для существующего, и для несуществующего адреса.
            if (user is null)
                return GenericEmailSent(null);

            var resetToken = await UpsertUserTokenAsync(user, UserTokenType.PasswordReset, requestContext, cancellationToken);
            await emailSender.SendPasswordResetAsync(user.Email, user.FirstName, resetToken, cancellationToken);

            return GenericEmailSent(resetToken);
        }

        public async Task<MessageResultModel> ResetPasswordAsync(ResetPasswordModel model, CancellationToken cancellationToken = default)
        {
            var token = await FindUsableTokenAsync(model.Token, UserTokenType.PasswordReset, cancellationToken)
                        ?? throw new ErrorModelException(GlobalErrorCode.ResetTokenInvalid, HttpStatusCode.BadRequest,
                            "Password reset token is invalid or expired.");

            var now = DateTime.UtcNow;
            var user = token.User;

            using var transaction = TransactionsHelper.CreateAsyncTransactionScope();

            user.Password = passwordHasher.Hash(model.NewPassword);
            user.FailedLoginAttempts = 0;
            user.LockedUntil = null;
            user.ForceToChangePass = false;
            token.UsedAtUtc = now;

            // Смена пароля обесценивает все выданные сессии — вынужденный ре-логин везде.
            await RevokeAllRefreshTokensAsync(user.Id, now, null, cancellationToken);

            await UserRepository.SaveChangesAsync(cancellationToken);
            transaction.Complete();

            return new MessageResultModel { Message = PasswordChangedMessage };
        }

        public async Task<MessageResultModel> ChangePasswordAsync(int userId, ChangePasswordModel model, string? currentRefreshToken, CancellationToken cancellationToken = default)
        {
            var user = await UserRepository.AsQueryable()
                                           .SingleOrDefaultAsync(x => x.Id == userId, cancellationToken)
                       ?? throw InvalidCredentials();

            if (!passwordHasher.Verify(model.CurrentPassword, user.Password))
                throw InvalidCredentials();

            var now = DateTime.UtcNow;
            var keptTokenHash = string.IsNullOrWhiteSpace(currentRefreshToken)
                ? null
                : jwtTokenService.HashRefreshToken(currentRefreshToken);

            using var transaction = TransactionsHelper.CreateAsyncTransactionScope();

            user.Password = passwordHasher.Hash(model.NewPassword);
            user.ForceToChangePass = false;

            // Текущая сессия остаётся живой: пользователь только что подтвердил старый
            // пароль, выкидывать его из собственного браузера незачем.
            await RevokeAllRefreshTokensAsync(user.Id, now, keptTokenHash, cancellationToken);

            await UserRepository.SaveChangesAsync(cancellationToken);
            transaction.Complete();

            return new MessageResultModel { Message = PasswordChangedMessage };
        }

        #endregion

        #region Helpers

        private async Task<User?> FindUserByLoginAsync(string usernameOrEmail, CancellationToken cancellationToken)
        {
            // Два запроса вместо одного OR: логин и почта уникальны по отдельности, но
            // ничто не мешает чужому Username совпасть со строкой чьего-то Email —
            // тогда OR дал бы две строки и SingleOrDefault упал бы.
            var byUsername = await UserRepository.AsQueryable()
                                                 .Include(x => x.Role)
                                                 .SingleOrDefaultAsync(x => x.Username == usernameOrEmail, cancellationToken);
            if (byUsername is not null)
                return byUsername;

            return await UserRepository.AsQueryable()
                                       .Include(x => x.Role)
                                       .SingleOrDefaultAsync(x => x.Email == usernameOrEmail, cancellationToken);
        }

        private async Task RegisterFailedAttemptAsync(User user, CancellationToken cancellationToken)
        {
            using var transaction = TransactionsHelper.CreateAsyncTransactionScope();

            user.FailedLoginAttempts += 1;
            if (user.FailedLoginAttempts >= MaxFailedLoginAttempts)
            {
                // Счётчик обнуляется вместе с блокировкой: после её истечения у пользователя
                // снова полный лимит попыток, а не мгновенная повторная блокировка.
                user.LockedUntil = DateTime.UtcNow.AddMinutes(LockoutMinutes);
                user.FailedLoginAttempts = 0;
            }

            await UserRepository.SaveChangesAsync(cancellationToken);
            transaction.Complete();
        }

        // Активный (непогашенный и непросроченный) токен нужного назначения вместе с владельцем.
        private async Task<UserToken?> FindUsableTokenAsync(string token, UserTokenType type, CancellationToken cancellationToken)
        {
            var storedToken = await UserTokenRepository.AsQueryable()
                                                       .Include(x => x.User)
                                                       .SingleOrDefaultAsync(x => x.Token == token && x.Type == type, cancellationToken);

            if (storedToken is null || storedToken.UsedAtUtc.HasValue || storedToken.ExpiresAtUtc <= DateTime.UtcNow)
                return null;

            return storedToken;
        }

        // Один активный токен на (UserId, Type): существующая строка переписывается,
        // новая заводится только если её ещё нет (ADR 006).
        private async Task<string> UpsertUserTokenAsync(User user, UserTokenType type, RequestContextModel requestContext, CancellationToken cancellationToken)
        {
            var existingToken = await UserTokenRepository.AsQueryable()
                                                         .SingleOrDefaultAsync(x => x.UserId == user.Id && x.Type == type, cancellationToken);

            var tokenValue = RandomTokenGenerator.Create();
            var now = DateTime.UtcNow;

            if (existingToken is null)
            {
                await UserTokenRepository.AddAsync(new UserToken
                {
                    UserId = user.Id,
                    Type = type,
                    Token = tokenValue,
                    RequestedAtUtc = now,
                    RequestIp = requestContext.IpAddress,
                    UserAgent = requestContext.UserAgent,
                    ExpiresAtUtc = now.AddMinutes(EmailTokenLifetimeMinutes)
                }, cancellationToken);
            }
            else
            {
                existingToken.Token = tokenValue;
                existingToken.RequestedAtUtc = now;
                existingToken.RequestIp = requestContext.IpAddress;
                existingToken.UserAgent = requestContext.UserAgent;
                existingToken.ExpiresAtUtc = now.AddMinutes(EmailTokenLifetimeMinutes);
                existingToken.UsedAtUtc = null;
            }

            await UserTokenRepository.SaveChangesAsync(cancellationToken);
            return tokenValue;
        }

        // Помечает отозванными все живые refresh-токены пользователя, кроме keptTokenHash.
        // SaveChanges вызывает вызывающий — операция всегда часть большей транзакции.
        private async Task RevokeAllRefreshTokensAsync(int userId, DateTime revokedAtUtc, string? keptTokenHash, CancellationToken cancellationToken)
        {
            var activeTokens = await RefreshTokenRepository.AsQueryable()
                                                           .Where(x => x.UserId == userId && x.RevokedAtUtc == null)
                                                           .ToListAsync(cancellationToken);

            foreach (var activeToken in activeTokens)
            {
                if (keptTokenHash is not null && activeToken.TokenHash == keptTokenHash)
                    continue;

                activeToken.RevokedAtUtc = revokedAtUtc;
            }
        }

        // Токен возвращается наружу только dev-отправителем, который письмо не доставляет.
        private MessageResultModel GenericEmailSent(string? token) => new()
        {
            Message = GenericEmailSentMessage,
            DevToken = emailSender.ExposesTokenToCaller ? token : null
        };

        private string BuildUserToken(User user, UserTokenType type, RequestContextModel requestContext, out UserToken tokenEntity)
        {
            var tokenValue = RandomTokenGenerator.Create();
            var now = DateTime.UtcNow;

            tokenEntity = new UserToken
            {
                User = user,
                Type = type,
                Token = tokenValue,
                RequestedAtUtc = now,
                RequestIp = requestContext.IpAddress,
                UserAgent = requestContext.UserAgent,
                ExpiresAtUtc = now.AddMinutes(EmailTokenLifetimeMinutes)
            };

            return tokenValue;
        }

        // Гасит ТОЛЬКО предъявленный токен: блокировка и снятие верификации — легитимное
        // состояние учётки, а не компрометация цепочки, поэтому остальные сессии не трогаем
        // (каждую отклонит эта же проверка при её собственной ротации).
        //
        // Статус 401, а не 403 как у тех же кодов в LoginAsync: там пароль был верен и речь
        // о доступе к ресурсу, здесь же перестала быть валидной сама сессия — фронт обязан
        // разлогинить пользователя, а обработчики refresh реагируют именно на 401.
        private async Task<ErrorModelException> RevokeAndRejectAsync(RefreshToken storedToken, DateTime revokedAtUtc,
            GlobalErrorCode errorCode, string message, CancellationToken cancellationToken)
        {
            storedToken.RevokedAtUtc = revokedAtUtc;
            await RefreshTokenRepository.SaveChangesAsync(cancellationToken);

            return new ErrorModelException(errorCode, HttpStatusCode.Unauthorized, message);
        }

        private static ErrorModelException InvalidCredentials()
            => new(GlobalErrorCode.InvalidCredentials, HttpStatusCode.Unauthorized, "Invalid credentials.");

        private static ErrorModelException RefreshTokenInvalid()
            => new(GlobalErrorCode.RefreshTokenInvalid, HttpStatusCode.Unauthorized, "Refresh token is invalid or expired.");

        #endregion
    }
}
