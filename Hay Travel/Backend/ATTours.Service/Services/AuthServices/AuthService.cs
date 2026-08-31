using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.Email;
using ATTours.BusinessServices.Geo;
using ATTours.BusinessServices.Security;
using ATTours.BusinessServices.Services.Authorization;
using ATTours.BusinessServices.Services.ValidationServices;
using ATTours.Common.Constants;
using ATTours.Common.DTO.Auth;
using ATTours.Common.DTO.Authorization;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.ContextRepository.Helpers;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using ATTours.ContextRepository.RepositoryImplementation.Relational;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using ATTours.Helper.Security;
using AutoMapper;
using Microsoft.EntityFrameworkCore;
using System.Net;
using System.Text.RegularExpressions;

namespace ATTours.BusinessServices.Services.AuthServices
{
    // Единственная точка, где меняется состояние аутентификации: пароли, подтверждение
    // почты, блокировки и сессии. Доступ к БД — как у соседних сервисов (свой контекст
    // по строке из CommonSettings); DI отвечает только за коллабораторов (ADR 005).
    public partial class AuthService : RepositoryCoreBase<User, ATToursContextFactory>, IAuthService
    {
        private const int MaxFailedLoginAttempts = 5;
        private const int LockoutMinutes = 15;
        private const int EmailTokenLifetimeMinutes = 60;

        // Email-change flow (B8, 2026-08-06): и время жизни кода на старый email, и окно
        // свежести OldEmailConfirmedAtUtc, за которое нужно успеть запросить новый email.
        private const int EmailChangeCodeLifetimeMinutes = 15;
        private const int EmailChangeCodeLength = 6;

        // Кулдаун повторной отправки письма подтверждения (2026-08-27): считается по
        // RequestedAtUtc уже выпущенного токена, а не по счётчику в памяти — иначе
        // рестарт процесса или второй инстанс API обнуляли бы защиту.
        private const int ResendVerificationCooldownSeconds = 60;

        // Окно прощения гонки ротации refresh-токена (ADR 033). Хватает на перекос часов и
        // сетевой round-trip между двумя устройствами, которые честно гонятся за один и тот
        // же истёкший access-токен; украденный токен всплывает минутами позже и в окно уже
        // не попадает. Единственная ручка настройки этого поведения.
        private const int RefreshReuseGraceSeconds = 10;

        // Один и тот же текст для «письмо ушло» и «такого аккаунта нет» — иначе по ответу
        // перебирались бы зарегистрированные адреса.
        private const string GenericEmailSentMessage =
            "If the address is registered, we have sent an email with further instructions.";

        private const string PasswordChangedMessage = "Password has been changed.";
        private const string EmailVerifiedMessage = "Email has been verified.";

        // Админ-инициированный сброс (2026-08-27): адресат известен, поэтому текст прямой,
        // а не generic — скрывать здесь нечего.
        private const string PasswordResetEmailSentMessage = "Password reset email has been sent.";

        private const string EmailChangeCodeSentMessage = "A verification code has been sent to your current email address.";
        private const string EmailChangeCodeConfirmedMessage = "Code confirmed. You can now request the new email address.";
        private const string EmailChangeConfirmationSentMessage = "A confirmation link has been sent to the new email address.";
        private const string EmailChangedMessage = "Email address has been changed.";

        private readonly IMapper mapper;
        private readonly IPasswordHasher passwordHasher;
        private readonly IJwtTokenService jwtTokenService;
        private readonly IEmailSender emailSender;
        private readonly EmailSettings emailSettings;
        private readonly IGeoIpLookup geoIpLookup;
        private readonly IAccessTokenRevocationRegistry accessTokenRevocationRegistry;
        private readonly ISessionRevocationRegistry sessionRevocationRegistry;

        public AuthService(IMapper mapper, IPasswordHasher passwordHasher, IJwtTokenService jwtTokenService,
            IEmailSender emailSender, EmailSettings emailSettings, IGeoIpLookup geoIpLookup,
            IAccessTokenRevocationRegistry accessTokenRevocationRegistry,
            ISessionRevocationRegistry sessionRevocationRegistry)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.mapper = mapper;
            this.passwordHasher = passwordHasher;
            this.jwtTokenService = jwtTokenService;
            this.emailSender = emailSender;
            this.emailSettings = emailSettings;
            this.geoIpLookup = geoIpLookup;
            this.accessTokenRevocationRegistry = accessTokenRevocationRegistry;
            this.sessionRevocationRegistry = sessionRevocationRegistry;
        }

        // Notification Templates (2026-08-31): auth-письма больше не хардкодятся в
        // EmailMessageFactory — subject/body читаются из NotificationTemplate по Trigger и
        // рендерятся тем же синтаксисом {{Token}}, что и остальные шаблоны (см.
        // NotificationAuthPlaceholders — фиксированный набор токенов конкретного потока,
        // не общий каталог полей сущности). Шаблон отсутствует (например, админ снял
        // назначение) -> тихо не шлём, как и у заказных уведомлений: операция (регистрация/
        // сброс пароля) уже состоялась в БД, письмо — побочный эффект, а не её условие.
        private async Task SendAuthEmailAsync(NotificationTemplateTrigger trigger, string toEmail, string toName,
            IReadOnlyDictionary<string, string> tokens, CancellationToken cancellationToken)
        {
            var template = await Context.Set<NotificationTemplate>()
                                        .AsNoTracking()
                                        .SingleOrDefaultAsync(x => x.Trigger == trigger, cancellationToken);

            if (template is null)
                return;

            var subject = RenderAuthTemplate(template.Subject, tokens, encodeText: false);
            var bodyHtml = RenderAuthTemplate(template.BodyHtml, tokens, encodeText: true);

            await emailSender.SendTransactionalAsync(toEmail, toName, subject, bodyHtml, cancellationToken: cancellationToken);
        }

        // Неизвестный токен -> пустая строка (то же правило, что у OrderNotificationService.
        // Render) — литерал {{Foo}} в письме выглядел бы как баг сильнее, чем пропуск.
        private static string RenderAuthTemplate(string source, IReadOnlyDictionary<string, string> tokens, bool encodeText)
        {
            if (string.IsNullOrEmpty(source))
                return string.Empty;

            return AuthPlaceholderRegex().Replace(source, match =>
            {
                if (!tokens.TryGetValue(match.Groups["token"].Value, out var value))
                    return string.Empty;

                return encodeText ? WebUtility.HtmlEncode(value) : value;
            });
        }

        [GeneratedRegex(@"\{\{(?<token>[A-Za-z0-9_]+)\}\}", RegexOptions.CultureInvariant)]
        private static partial Regex AuthPlaceholderRegex();

        #region Repositories

        private IEntityRepository<User> UserRepository => EntityRepository;

        private IEntityRepository<UserToken>? userTokenRepository;
        private IEntityRepository<UserToken> UserTokenRepository => userTokenRepository ??= new EntityRepository<UserToken>(Context);

        private IEntityRepository<RefreshToken>? refreshTokenRepository;
        private IEntityRepository<RefreshToken> RefreshTokenRepository => refreshTokenRepository ??= new EntityRepository<RefreshToken>(Context);

        private IEntityRepository<UserRole>? userRoleRepository;
        private IEntityRepository<UserRole> UserRoleRepository => userRoleRepository ??= new EntityRepository<UserRole>(Context);

        private IEntityRepository<EmailChangeRequest>? emailChangeRequestRepository;
        private IEntityRepository<EmailChangeRequest> EmailChangeRequestRepository => emailChangeRequestRepository ??= new EntityRepository<EmailChangeRequest>(Context);

        private IEntityRepository<LoginHistory>? loginHistoryRepository;
        private IEntityRepository<LoginHistory> LoginHistoryRepository => loginHistoryRepository ??= new EntityRepository<LoginHistory>(Context);

        private IEntityRepository<ImpersonationEvent>? impersonationEventRepository;
        private IEntityRepository<ImpersonationEvent> ImpersonationEventRepository => impersonationEventRepository ??= new EntityRepository<ImpersonationEvent>(Context);

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
                // Неверифицированному аккаунту переотправляем письмо. Тот же путь, что у
                // ResendVerificationEmailAsync (2026-08-27), включая кулдаун: повторная
                // отправка формы регистрации не должна обходить ограничение, доступное
                // отдельному эндпоинту.
                if (existingUser.IsEmailVerified)
                    return GenericEmailSent(null);

                return await ResendEmailVerificationAsync(existingUser, requestContext, cancellationToken);
            }

            var regularRole = await UserRoleRepository.AsQueryable()
                                                      .SingleOrDefaultAsync(role => role.Type == RoleType.Regular, cancellationToken)
                              ?? throw new ErrorModelException(GlobalErrorCode.RoleNotFound, HttpStatusCode.BadRequest,
                                  $"Default role '{RoleType.Regular}' is missing.");

            var user = mapper.Map<User>(model);
            // "" -> null (B1, 2026-08-06): не даёт в БД жить двум представлениям "нет телефона".
            user.PhoneNumber = string.IsNullOrWhiteSpace(user.PhoneNumber) ? null : user.PhoneNumber;
            user.RoleId = regularRole.Id;
            user.IsEmailVerified = false;
            user.FailedLoginAttempts = 0;
            user.LockedUntil = null;
            user.ForceToChangePass = false;
            user.Password = passwordHasher.Hash(model.Password);
            user.IsDeleted = false;
            user.RegisteredAtUtc = DateTime.UtcNow;
            user.RegisteredIp = requestContext.IpAddress;

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

            await SendAuthEmailAsync(NotificationTemplateTrigger.VerifyEmail, user.Email, user.FirstName,
                new Dictionary<string, string>
                {
                    [NotificationAuthPlaceholders.UserName] = user.FirstName,
                    [NotificationAuthPlaceholders.VerifyUrl] = EmailMessageFactory.BuildVerifyUrl(emailSettings, verificationToken)
                }, cancellationToken);
            return GenericEmailSent(verificationToken);
        }

        // Отдельная переотправка письма подтверждения (2026-08-27): до неё пользователю
        // приходилось заново отправлять всю форму регистрации. Ответ ровно тот же
        // generic, что у Register/ForgotPassword — по нему не отличить несуществующий
        // адрес от уже подтверждённого и от попавшего в кулдаун.
        public async Task<MessageResultModel> ResendVerificationEmailAsync(ResendVerificationModel model, RequestContextModel requestContext, CancellationToken cancellationToken = default)
        {
            var user = await UserRepository.AsQueryable()
                                           .SingleOrDefaultAsync(x => x.Email == model.Email, cancellationToken);

            if (user is null || user.IsEmailVerified)
                return GenericEmailSent(null);

            return await ResendEmailVerificationAsync(user, requestContext, cancellationToken);
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

            // Soft-deleted (B4, 2026-08-06): без этой проверки живой access/refresh токен
            // удалённого пользователя продолжал бы работать весь оставшийся TTL.
            if (user.IsDeleted)
                throw new ErrorModelException(GlobalErrorCode.AccountDeleted, HttpStatusCode.Unauthorized,
                    "Account has been deleted.");

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

            // Длина окна сессии — выбор пользователя на этом входе (ADR 029): 14 дней с
            // «запомнить меня» и час неактивности без него. Выбор посессионный, на аккаунте
            // не хранится, поэтому живёт на самой строке токена.
            var refreshToken = jwtTokenService.CreateRefreshToken(model.RememberMe);
            await RefreshTokenRepository.AddAsync(new RefreshToken
            {
                UserId = user.Id,
                TokenHash = refreshToken.TokenHash,
                ExpiresAtUtc = refreshToken.ExpiresAtUtc,
                CreatedAtUtc = now,
                CreatedByIp = requestContext.IpAddress,
                CreatedByUserAgent = requestContext.UserAgent,
                RememberMe = model.RememberMe
            }, cancellationToken);

            // История входов (C1, 2026-08-09) — только здесь: ротация refresh-токена
            // (RefreshAsync) новым входом не является и строку не пишет.
            // Резолв гео необязателен: без базы Lookup вернёт null, и запись просто ляжет
            // без страны/города.
            var location = geoIpLookup.Lookup(requestContext.IpAddress);
            await LoginHistoryRepository.AddAsync(new LoginHistory
            {
                UserId = user.Id,
                IpAddress = requestContext.IpAddress,
                CountryCode = location?.CountryCode,
                CountryName = location?.CountryName,
                City = location?.City,
                UserAgent = requestContext.UserAgent,
                LoggedInAtUtc = now
            }, cancellationToken);

            // Один контекст -> один SaveChanges -> обнуление счётчика, выдача сессии и
            // запись в историю входов фиксируются вместе.
            await UserRepository.SaveChangesAsync(cancellationToken);

            var accessToken = jwtTokenService.CreateAccessToken(user, await ResolvePermissionsAsync(user, cancellationToken),
                refreshToken.TokenHash);
            var result = new LoginResultModel
            {
                AccessToken = accessToken.AccessToken,
                ExpiresInSeconds = accessToken.ExpiresInSeconds,
                User = mapper.Map<UserInfoModel>(user),
                ForceChangePassword = user.ForceToChangePass
            };

            return new LoginOutcome(result, new IssuedRefreshToken(refreshToken.Token, refreshToken.ExpiresAtUtc, model.RememberMe));
        }

        // Дев-бэкдор (см. IAuthService.DevLoginAsync) — та же выдача токенов, что и
        // LoginAsync, без пароля/блокировки/верификации/записи в LoginHistory. Только для
        // локального UI-тестирования, вызывающий контроллер обязан гейтить IsDevelopment().
        public async Task<LoginOutcome> DevLoginAsync(string usernameOrEmail, RequestContextModel requestContext, CancellationToken cancellationToken = default)
        {
            var user = await FindUserByLoginAsync(usernameOrEmail, cancellationToken)
                       ?? throw InvalidCredentials();

            if (user.IsDeleted)
                throw new ErrorModelException(GlobalErrorCode.AccountDeleted, HttpStatusCode.Unauthorized,
                    "Account has been deleted.");

            var now = DateTime.UtcNow;

            // Дев-сессия всегда короткая: «запомнить меня» через бэкдор не предлагается.
            var refreshToken = jwtTokenService.CreateRefreshToken(rememberMe: false);
            await RefreshTokenRepository.AddAsync(new RefreshToken
            {
                UserId = user.Id,
                TokenHash = refreshToken.TokenHash,
                ExpiresAtUtc = refreshToken.ExpiresAtUtc,
                CreatedAtUtc = now,
                CreatedByIp = requestContext.IpAddress,
                CreatedByUserAgent = requestContext.UserAgent,
                RememberMe = false
            }, cancellationToken);
            await UserRepository.SaveChangesAsync(cancellationToken);

            var accessToken = jwtTokenService.CreateAccessToken(user, await ResolvePermissionsAsync(user, cancellationToken),
                refreshToken.TokenHash);
            var result = new LoginResultModel
            {
                AccessToken = accessToken.AccessToken,
                ExpiresInSeconds = accessToken.ExpiresInSeconds,
                User = mapper.Map<UserInfoModel>(user),
                ForceChangePassword = false
            };

            return new LoginOutcome(result, new IssuedRefreshToken(refreshToken.Token, refreshToken.ExpiresAtUtc, false));
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

            // Reuse-detection (ADR 033): предъявлен уже отозванный токен. Причину отзыва
            // различаем по ReplacedByTokenHash — заполнен только у токена, умершего РОТАЦИЕЙ.
            // До ADR 033 любой такой случай считался компрометацией и гасил все сессии, из-за
            // чего обычная гонка двух устройств за один истёкший access-токен выкидывала
            // пользователя отовсюду.
            if (storedToken.RevokedAtUtc.HasValue)
            {
                // 1. Прощаемая гонка ротации: токен умер ротацией, предъявлен внутри окна,
                //    и его НЕПОСРЕДСТВЕННЫЙ преемник (один хоп, дальше по цепочке не идём)
                //    ещё жив. Отставание на два хопа гонкой уже не является — это шаг 3.
                if (storedToken.ReplacedByTokenHash is not null &&
                    now - storedToken.RevokedAtUtc.Value <= TimeSpan.FromSeconds(RefreshReuseGraceSeconds))
                {
                    var head = await RefreshTokenRepository.AsQueryable()
                                                           .SingleOrDefaultAsync(x => x.TokenHash == storedToken.ReplacedByTokenHash, cancellationToken);

                    if (head is not null && head.RevokedAtUtc is null && head.ExpiresAtUtc > now)
                        return await CatchUpRotationAsync(storedToken, head, now, requestContext, cancellationToken);
                }

                // 2. Токен погашен ЯВНО (logout, смена пароля, отзыв сессии, флаш при
                //    impersonation) — преемника у него нет. Это не компрометация, а
                //    намеренно закрытая сессия, поэтому семью НЕ гасим: иначе «выйти на
                //    других устройствах» убивало бы и ту сессию, ради которой всё делалось.
                if (storedToken.ReplacedByTokenHash is null)
                    throw RefreshTokenInvalid();

                // 3. Всё остальное — настоящий reuse (ротированный токен вне окна или с уже
                //    мёртвой головой цепочки): прежнее консервативное поведение.
                await RevokeAllRefreshTokensAsync(storedToken.UserId, now, null, null, cancellationToken);
                await RefreshTokenRepository.SaveChangesAsync(cancellationToken);
                throw RefreshTokenInvalid();
            }

            if (storedToken.ExpiresAtUtc <= now)
                throw RefreshTokenInvalid();

            // Состояние учётки перепроверяется на каждой ротации: сессия живёт 14 дней и
            // переживает блокировку, поэтому без этой проверки заблокированный (или удалённый,
            // B4) пользователь продлевал бы себе доступ бесконечно, просто потому что
            // залогинился раньше. Порядок проверок тот же, что в LoginAsync: сперва soft-delete,
            // потом блокировка, потом почта.
            var user = storedToken.User;

            if (user.IsDeleted)
                throw await RevokeAndRejectAsync(storedToken, now, GlobalErrorCode.AccountDeleted,
                    "Account has been deleted.", cancellationToken);

            if (user.LockedUntil.HasValue && user.LockedUntil.Value > now)
                throw await RevokeAndRejectAsync(storedToken, now, GlobalErrorCode.AccountLocked,
                    "Account is temporarily locked.", cancellationToken);

            if (!user.IsEmailVerified)
                throw await RevokeAndRejectAsync(storedToken, now, GlobalErrorCode.EmailNotVerified,
                    "Email is not verified.", cancellationToken);

            // Окно считается заново от «сейчас» и той же длины, что выбрал пользователь на
            // входе (ADR 029) — сессия скользит, пока ей пользуются.
            var rotatedToken = jwtTokenService.CreateRefreshToken(storedToken.RememberMe);

            storedToken.RevokedAtUtc = now;
            storedToken.ReplacedByTokenHash = rotatedToken.TokenHash;

            await RefreshTokenRepository.AddAsync(new RefreshToken
            {
                UserId = storedToken.UserId,
                TokenHash = rotatedToken.TokenHash,
                ExpiresAtUtc = rotatedToken.ExpiresAtUtc,
                CreatedAtUtc = now,
                CreatedByIp = requestContext.IpAddress,
                CreatedByUserAgent = requestContext.UserAgent,
                // Оба поля — свойства СЕССИИ, а не отдельного токена: без переноса
                // «запомнить меня» схлопнулось бы до часа, а баннер impersonation
                // пропал бы на первой же ротации (spec 014 §3.3, §4.3).
                RememberMe = storedToken.RememberMe,
                ImpersonatedByUserId = storedToken.ImpersonatedByUserId
            }, cancellationToken);

            await RefreshTokenRepository.SaveChangesAsync(cancellationToken);

            // Права перерезолвливаются на КАЖДОЙ ротации (§0.2): именно это, а не отдельный
            // форс-релогин, применяет изменения матрицы/override у уже залогиненных
            // пользователей — максимум через один TTL access-токена.
            var accessToken = jwtTokenService.CreateAccessToken(user,
                await ResolvePermissionsAsync(user, cancellationToken),
                rotatedToken.TokenHash,
                storedToken.ImpersonatedByUserId);

            return new RefreshOutcome(accessToken,
                new IssuedRefreshToken(rotatedToken.Token, rotatedToken.ExpiresAtUtc, storedToken.RememberMe));
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

        #region Impersonation (spec 014 §3, ADR 028/030)

        // «Войти как пользователь». Односторонняя операция: возврата в свой аккаунт нет —
        // сессии админа гасятся здесь же, обратно он попадает только обычным логином
        // (требование бизнеса, ADR 028). Живёт в AuthService, потому что это ровно смена
        // состояния аутентификации: отзыв сессий + выдача токенов.
        public async Task<LoginOutcome> ImpersonateAsync(int actingUserId, int targetUserId,
            RequestContextModel requestContext, CancellationToken cancellationToken = default)
        {
            var actingUser = await UserRepository.AsQueryable()
                                                 .Include(x => x.Role)
                                                 .SingleOrDefaultAsync(x => x.Id == actingUserId && !x.IsDeleted, cancellationToken)
                             ?? throw InvalidCredentials();

            var targetUser = await UserRepository.AsQueryable()
                                                 .Include(x => x.Role)
                                                 .SingleOrDefaultAsync(x => x.Id == targetUserId, cancellationToken);

            // Тот же код и статус, что у остального UsersController для «нет такого юзера».
            if (targetUser is null || targetUser.IsDeleted)
                throw new ErrorModelException(GlobalErrorCode.RelationalEntityNotFound, HttpStatusCode.NotFound,
                    $"User with id {targetUserId} not found.");

            if (targetUserId == actingUserId)
                throw new ErrorModelException(GlobalErrorCode.CannotImpersonateSelf, HttpStatusCode.BadRequest,
                    "You cannot impersonate yourself.");

            // Защита от эскалации привилегий (ADR 028): роль с can_impersonate — это не
            // право «стать кем угодно». Не-SuperAdmin может входить только в «обычные»
            // аккаунты; иначе низкодоверенная роль дотянулась бы до SuperAdmin'а.
            // Проверяем по БД, а не по claim'ам токена — как GuardRoleChange.
            if (!actingUser.IsSuperAdmin &&
                (targetUser.IsSuperAdmin || targetUser.Role?.CanManageAdmins == true || targetUser.Role?.CanImpersonate == true))
                throw new ErrorModelException(GlobalErrorCode.ImpersonationTargetNotAllowed, HttpStatusCode.Forbidden,
                    "You are not allowed to impersonate this user.");

            var now = DateTime.UtcNow;

            // Состояние цели проверяется ЗДЕСЬ, теми же кодами и в том же порядке, что в
            // LoginAsync/RefreshAsync (блокировка, затем почта). Без этого вход в
            // заблокированный/неподтверждённый аккаунт выдавал бы рабочую сессию, а падал
            // бы только на первой ротации в RefreshAsync — непрозрачно для админа.
            // Статус — 400, а НЕ 401/403 как на логине: отказ относится к цели, а не к
            // вызывающему; 401 фронт админки трактует как «мой токен мёртв» (§8) и вышел бы
            // из сессии, 403 — как «нет права impersonate».
            // Порядок относительно гарда эскалации намеренный: он идёт раньше, чтобы
            // не-SuperAdmin не мог по коду ошибки узнать состояние привилегированной учётки.
            if (targetUser.LockedUntil.HasValue && targetUser.LockedUntil.Value > now)
                throw new ErrorModelException(GlobalErrorCode.AccountLocked, HttpStatusCode.BadRequest,
                    "Target account is temporarily locked.");

            if (!targetUser.IsEmailVerified)
                throw new ErrorModelException(GlobalErrorCode.EmailNotVerified, HttpStatusCode.BadRequest,
                    "Target account email is not verified.");

            // Сессия impersonation'а всегда короткая: «запомнить меня» для чужого аккаунта
            // не имеет смысла (spec 014 §3.3).
            var refreshToken = jwtTokenService.CreateRefreshToken(rememberMe: false);

            using (var transaction = TransactionsHelper.CreateAsyncTransactionScope())
            {
                // Сессия админа перестаёт существовать на сервере.
                await RevokeAllRefreshTokensAsync(actingUserId, now, null, null, cancellationToken);

                await RefreshTokenRepository.AddAsync(new RefreshToken
                {
                    UserId = targetUserId,
                    TokenHash = refreshToken.TokenHash,
                    ExpiresAtUtc = refreshToken.ExpiresAtUtc,
                    CreatedAtUtc = now,
                    CreatedByIp = requestContext.IpAddress,
                    CreatedByUserAgent = requestContext.UserAgent,
                    RememberMe = false,
                    ImpersonatedByUserId = actingUserId
                }, cancellationToken);

                await ImpersonationEventRepository.AddAsync(new ImpersonationEvent
                {
                    ImpersonatorUserId = actingUserId,
                    TargetUserId = targetUserId,
                    CreatedAtUtc = now,
                    IpAddress = requestContext.IpAddress,
                    UserAgent = requestContext.UserAgent
                }, cancellationToken);

                // Мгновенный отзыв уже выданных access-токенов админа (ADR 030): отзыва
                // refresh-токенов мало — stateless JWT прожил бы ещё до 15 минут в другой
                // вкладке. Запись в реестр — in-memory и вне транзакции; при откате коммита
                // она лишь заставит самого админа перелогиниться (fail-safe направление,
                // лишних прав не даёт никогда).
                accessTokenRevocationRegistry.Revoke(actingUserId, now,
                    now.AddMinutes(JwtSettings.Instance.AccessTokenMinutes));

                await RefreshTokenRepository.SaveChangesAsync(cancellationToken);
                transaction.Complete();
            }

            var accessToken = jwtTokenService.CreateAccessToken(targetUser,
                await ResolvePermissionsAsync(targetUser, cancellationToken),
                refreshToken.TokenHash,
                impersonatedByUserId: actingUserId);

            var result = new LoginResultModel
            {
                AccessToken = accessToken.AccessToken,
                ExpiresInSeconds = accessToken.ExpiresInSeconds,
                User = mapper.Map<UserInfoModel>(targetUser),
                // Чужой аккаунт админ не «чинит»: форсить смену пароля в этой сессии нечего.
                ForceChangePassword = false
            };

            return new LoginOutcome(result, new IssuedRefreshToken(refreshToken.Token, refreshToken.ExpiresAtUtc, false));
        }

        #endregion

        #region Session management (spec 017 §4)

        // И чтение, и отзыв сессий живут здесь, а не в отдельном Info-сервисе (spec 017 §4.3):
        // любая запись по RefreshToken — домен AuthService (ADR 005/028), и именно здесь уже
        // есть и репозиторий, и хеширование токена, и geo-lookup. LoginHistory вынесен в
        // Info-сервис только потому, что это read-only сущность без auth-мутаций.

        public async Task<List<SessionInfoModel>> GetMySessionsAsync(int userId, string? currentRefreshToken, CancellationToken cancellationToken = default)
        {
            // Текущая сессия помечается сравнением ХЕШЕЙ: plaintext из cookie наружу не
            // возвращается и с БД не сопоставляется никак иначе.
            var currentTokenHash = string.IsNullOrWhiteSpace(currentRefreshToken)
                ? null
                : jwtTokenService.HashRefreshToken(currentRefreshToken);

            return await BuildSessionListAsync(userId, currentTokenHash, cancellationToken);
        }

        public async Task RevokeMySessionAsync(int userId, int sessionId, CancellationToken cancellationToken = default)
            => await RevokeSessionAsync(userId, sessionId, cancellationToken);

        public async Task RevokeMyOtherSessionsAsync(int userId, string? currentRefreshToken, CancellationToken cancellationToken = default)
        {
            // Тот же приём, что в ChangePasswordAsync: сессия вызывающего переживает отзыв.
            // Пустой cookie означает «не сохранять ничего» — но у вызывающего он всегда есть,
            // иначе он бы сюда не дошёл ([Authorize] + refresh-cookie ставятся вместе.)
            var keptTokenHash = string.IsNullOrWhiteSpace(currentRefreshToken)
                ? null
                : jwtTokenService.HashRefreshToken(currentRefreshToken);

            await RevokeAllRefreshTokensAsync(userId, DateTime.UtcNow, keptTokenHash, null, cancellationToken);
            await RefreshTokenRepository.SaveChangesAsync(cancellationToken);
        }

        // Админская вьюха: IsCurrent тут всегда false — админ смотрит чужие сессии, своего
        // cookie цели у него нет и быть не может.
        public async Task<List<SessionInfoModel>> GetUserSessionsAsync(int targetUserId, CancellationToken cancellationToken = default)
            => await BuildSessionListAsync(targetUserId, null, cancellationToken);

        public async Task RevokeUserSessionAsync(int targetUserId, int sessionId, CancellationToken cancellationToken = default)
            => await RevokeSessionAsync(targetUserId, sessionId, cancellationToken);

        public async Task RevokeAllUserSessionsAsync(int targetUserId, int actingUserId, CancellationToken cancellationToken = default)
        {
            // keptTokenHash = null намеренно: админ не залогинен как цель, поэтому «текущая»
            // сессия цели тоже должна погаснуть — иначе смысл кнопки теряется.
            //
            // Но собственную impersonation-сессию ЭТОГО админа над этой же целью щадим
            // (David, 2026-08-29): иначе «завершить все сессии» на карточке пользователя,
            // которого сам админ сейчас изображает (другая вкладка/устройство — в этой же
            // вкладке isSelf уже увёл бы на самообслуживающую ветку), выбивает и его
            // собственный рабочий сеанс. Отзыв ОДНОЙ конкретной сессии по id по-прежнему
            // может погасить и эту — это явный выбор конкретной строки, не бланковый.
            await RevokeAllRefreshTokensAsync(targetUserId, DateTime.UtcNow, null, actingUserId, cancellationToken);
            await RefreshTokenRepository.SaveChangesAsync(cancellationToken);
        }

        // Живые сессии пользователя: непогашенные и непросроченные, свежие сверху.
        private async Task<List<SessionInfoModel>> BuildSessionListAsync(int userId, string? currentTokenHash, CancellationToken cancellationToken)
        {
            var now = DateTime.UtcNow;

            var sessions = await RefreshTokenRepository.AsQueryable()
                                                       .Where(x => x.UserId == userId && x.RevokedAtUtc == null && x.ExpiresAtUtc > now)
                                                       .OrderByDescending(x => x.CreatedAtUtc)
                                                       .ToListAsync(cancellationToken);

            var result = mapper.Map<List<SessionInfoModel>>(sessions);

            for (var index = 0; index < sessions.Count; index++)
            {
                // Гео на строке сессии не хранится (в отличие от LoginHistory) — резолвится
                // на чтении: lookup локальный и дешёвый, а без базы просто вернёт null.
                var location = geoIpLookup.Lookup(sessions[index].CreatedByIp);
                result[index].CountryCode = location?.CountryCode;
                result[index].CountryName = location?.CountryName;
                result[index].City = location?.City;

                result[index].IsCurrent = currentTokenHash is not null && sessions[index].TokenHash == currentTokenHash;
            }

            return result;
        }

        // Общий путь отзыва одной сессии для самообслуживания и админки: различие только в
        // том, чей id считается владельцем.
        private async Task RevokeSessionAsync(int userId, int sessionId, CancellationToken cancellationToken)
        {
            var session = await RefreshTokenRepository.AsQueryable()
                                                      .SingleOrDefaultAsync(x => x.Id == sessionId, cancellationToken);

            // Гард владения: чужая строка отвечает тем же 404, что и несуществующая. Именно
            // он не даёт обычному пользователю погасить сессию постороннего по её id, и по
            // коду ответа такие id не перебираются.
            if (session is null || session.UserId != userId)
                throw new ErrorModelException(GlobalErrorCode.RelationalEntityNotFound, HttpStatusCode.NotFound,
                    $"Session with id {sessionId} not found.");

            // Идемпотентность, как у LogoutAsync: уже отозванная сессия — не ошибка,
            // конечное состояние и так достигнуто.
            if (session.RevokedAtUtc.HasValue)
                return;

            // ReplacedByTokenHash остаётся пустым — это явное гашение, а не ротация. Именно
            // по нему reuse-detection (ADR 033) отличает такую сессию от гонки и НЕ гасит
            // из-за неё остальные.
            var now = DateTime.UtcNow;
            session.RevokedAtUtc = now;

            // Мгновенный отзыв уже выданного access-токена ЭТОЙ сессии (David, 2026-08-31):
            // отзыва refresh-токена мало — access-токен ещё до 15 минут (AccessTokenMinutes)
            // прожил бы на устройстве, которое отозвали, никак этого не заметив (та же
            // причина, что у accessTokenRevocationRegistry.Revoke в ImpersonateAsync, ADR 030,
            // только точечно по сессии, а не по всем токенам пользователя — иначе завершение
            // ЧУЖОЙ сессии выбило бы и ту, с которой его вызвали).
            sessionRevocationRegistry.Revoke(session.TokenHash, now,
                now.AddMinutes(JwtSettings.Instance.AccessTokenMinutes));

            await RefreshTokenRepository.SaveChangesAsync(cancellationToken);
        }

        #endregion

        #region Permissions

        // Свежий (из БД, не из токена) резолв прав текущего пользователя для гардов фронта
        // (architecture-flexible-roles.md §3.3, §4.1). Enforcement на бэке при этом остаётся
        // по claim'у токена — UI просто перерисовывается, не дожидаясь ротации.
        public async Task<MyPermissionsModel> GetMyPermissionsAsync(int userId, CancellationToken cancellationToken = default)
        {
            var user = await UserRepository.AsQueryable()
                                           .Include(x => x.Role)
                                           .SingleOrDefaultAsync(x => x.Id == userId && !x.IsDeleted, cancellationToken)
                       ?? throw InvalidCredentials();

            var resolved = await ResolvePermissionsAsync(user, cancellationToken);

            var result = mapper.Map<MyPermissionsModel>(resolved);
            // Вне матрицы прав по решению 10 чек-листа — доклеивается отдельным полем.
            result.IsSuperAdmin = user.IsSuperAdmin;

            return result;
        }

        // Резолвер держит собственный контекст (как и остальные сервисы, создаваемые через
        // `new`), поэтому живёт ровно на время вызова и не может закрыть контекст AuthService.
        private static async Task<ResolvedPermissionSet> ResolvePermissionsAsync(User user, CancellationToken cancellationToken)
        {
            using var resolver = new PermissionResolutionService(cancellationToken);
            return await resolver.ResolveAsync(user.Id, user.RoleId, user.IsSuperAdmin);
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

            var resetToken = await IssuePasswordResetTokenAsync(user, requestContext, cancellationToken);
            return GenericEmailSent(resetToken);
        }

        // Админ-инициированный сброс пароля клиента (2026-08-27). Выпуск токена и письмо —
        // ровно те же, что в ForgotPasswordAsync (один активный токен на (UserId, Type),
        // ADR 006), поэтому механика живёт здесь, а не дублируется в UpdateServices;
        // вызывающий сервис отвечает только за поиск цели и права на действие.
        //
        // Пользователь приходит уже загруженным (из контекста вызывающего сервиса) — здесь
        // читаются только Id/Email/FirstName, так что чужой tracking-контекст не задевается.
        // Ответ обычный, без анти-энумерации: адресат админу и так известен.
        public async Task<MessageResultModel> SendPasswordResetEmailAsync(User user, RequestContextModel requestContext, CancellationToken cancellationToken = default)
        {
            var resetToken = await IssuePasswordResetTokenAsync(user, requestContext, cancellationToken);

            return new MessageResultModel
            {
                Message = PasswordResetEmailSentMessage,
                DevToken = emailSender.ExposesTokenToCaller ? resetToken : null
            };
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
            await RevokeAllRefreshTokensAsync(user.Id, now, null, null, cancellationToken);

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
            await RevokeAllRefreshTokensAsync(user.Id, now, keptTokenHash, null, cancellationToken);

            await UserRepository.SaveChangesAsync(cancellationToken);
            transaction.Complete();

            return new MessageResultModel { Message = PasswordChangedMessage };
        }

        #endregion

        #region Email change (B8, 2026-08-06)

        // Шаг 1: код на ТЕКУЩИЙ email. Апсертит строку по UserId (тот же приём, что
        // UpsertUserTokenAsync) — каждый вызов начинает флоу заново, хвосты прошлой
        // незавершённой попытки (PendingNewEmail/NewEmailToken) сбрасываются.
        public async Task<MessageResultModel> RequestEmailChangeAsync(int userId, RequestContextModel requestContext, CancellationToken cancellationToken = default)
        {
            var user = await UserRepository.AsQueryable()
                                           .SingleOrDefaultAsync(x => x.Id == userId, cancellationToken)
                       ?? throw InvalidCredentials();

            var request = await EmailChangeRequestRepository.AsQueryable()
                                                             .SingleOrDefaultAsync(x => x.UserId == userId, cancellationToken);

            var code = RandomTokenGenerator.CreateNumericCode(EmailChangeCodeLength);
            var now = DateTime.UtcNow;

            if (request is null)
            {
                request = new EmailChangeRequest { UserId = userId };
                await EmailChangeRequestRepository.AddAsync(request, cancellationToken);
            }

            request.OldEmailCode = code;
            request.OldEmailRequestedAtUtc = now;
            request.OldEmailExpiresAtUtc = now.AddMinutes(EmailChangeCodeLifetimeMinutes);
            request.OldEmailConfirmedAtUtc = null;
            request.PendingNewEmail = null;
            request.NewEmailToken = null;
            request.NewEmailRequestedAtUtc = null;
            request.NewEmailExpiresAtUtc = null;
            request.RequestIp = requestContext.IpAddress;
            request.UserAgent = requestContext.UserAgent;
            request.UsedAtUtc = null;

            await EmailChangeRequestRepository.SaveChangesAsync(cancellationToken);
            await SendAuthEmailAsync(NotificationTemplateTrigger.EmailChangeCode, user.Email, user.FirstName,
                new Dictionary<string, string>
                {
                    [NotificationAuthPlaceholders.UserName] = user.FirstName,
                    [NotificationAuthPlaceholders.Code] = code
                }, cancellationToken);

            return new MessageResultModel
            {
                Message = EmailChangeCodeSentMessage,
                DevToken = emailSender.ExposesTokenToCaller ? code : null
            };
        }

        // Шаг 2: подтверждение кода, присланного на старый email.
        public async Task<MessageResultModel> ConfirmEmailChangeCodeAsync(int userId, ConfirmEmailChangeCodeModel model, CancellationToken cancellationToken = default)
        {
            var request = await EmailChangeRequestRepository.AsQueryable()
                                                             .SingleOrDefaultAsync(x => x.UserId == userId, cancellationToken);

            var now = DateTime.UtcNow;

            // "не использован" (спека B8) — код, уже подтверждённый ранее, повторно не проходит:
            // пользователю нужно начать флоу заново запросом нового кода.
            if (request is null || request.OldEmailConfirmedAtUtc.HasValue ||
                request.OldEmailExpiresAtUtc <= now || request.OldEmailCode != model.Code)
                throw EmailChangeCodeInvalid();

            request.OldEmailConfirmedAtUtc = now;
            await EmailChangeRequestRepository.SaveChangesAsync(cancellationToken);

            return new MessageResultModel { Message = EmailChangeCodeConfirmedMessage };
        }

        // Шаг 3: новый email. Требует свежего OldEmailConfirmedAtUtc (то же 15-минутное окно,
        // что и код) — иначе пользователь обязан начать заново с шага 1.
        //
        // РЕШЕНИЕ ДАВИДА (2026-08-06): в отличие от Register, занятый адрес отвечает явной
        // 400-ошибкой (EmailAlreadyTaken), а не generic-200 — пользователь уже аутентифицирован,
        // анти-энумерация из Register сюда не переносится.
        public async Task<MessageResultModel> RequestNewEmailAsync(int userId, RequestNewEmailModel model, RequestContextModel requestContext, CancellationToken cancellationToken = default)
        {
            var request = await EmailChangeRequestRepository.AsQueryable()
                                                             .SingleOrDefaultAsync(x => x.UserId == userId, cancellationToken);

            var now = DateTime.UtcNow;
            if (request is null || !request.OldEmailConfirmedAtUtc.HasValue ||
                request.OldEmailConfirmedAtUtc.Value.AddMinutes(EmailChangeCodeLifetimeMinutes) <= now)
                throw new ErrorModelException(GlobalErrorCode.EmailChangeNotConfirmed, HttpStatusCode.BadRequest,
                    "The old email code has not been confirmed, or the confirmation has expired. Start over.");

            var user = await UserRepository.AsQueryable()
                                           .SingleOrDefaultAsync(x => x.Id == userId, cancellationToken)
                       ?? throw InvalidCredentials();

            // РЕШЕНИЕ ДАВИДА: явная ошибка, не generic-200 (см. комментарий над методом).
            if (string.Equals(model.NewEmail, user.Email, StringComparison.OrdinalIgnoreCase))
                throw EmailAlreadyTaken();

            var emailTaken = await UserRepository.AsQueryable()
                                                 .AnyAsync(x => x.Email == model.NewEmail && !x.IsDeleted && x.Id != userId, cancellationToken);
            if (emailTaken)
                throw EmailAlreadyTaken();

            var token = RandomTokenGenerator.Create();

            request.PendingNewEmail = model.NewEmail;
            request.NewEmailToken = token;
            request.NewEmailRequestedAtUtc = now;
            request.NewEmailExpiresAtUtc = now.AddMinutes(EmailTokenLifetimeMinutes);
            request.RequestIp = requestContext.IpAddress;
            request.UserAgent = requestContext.UserAgent;

            await EmailChangeRequestRepository.SaveChangesAsync(cancellationToken);
            await SendAuthEmailAsync(NotificationTemplateTrigger.EmailChangeConfirm, model.NewEmail, user.FirstName,
                new Dictionary<string, string>
                {
                    [NotificationAuthPlaceholders.UserName] = user.FirstName,
                    [NotificationAuthPlaceholders.ConfirmUrl] = EmailMessageFactory.BuildEmailChangeConfirmUrl(emailSettings, token)
                }, cancellationToken);

            return new MessageResultModel
            {
                Message = EmailChangeConfirmationSentMessage,
                DevToken = emailSender.ExposesTokenToCaller ? token : null
            };
        }

        // Шаг 4: переход по ссылке из письма на новый email — AllowAnonymous (та же логика,
        // что VerifyEmailAsync: ссылка может открыться без живого access-токена).
        //
        // РЕШЕНИЕ ДАВИДА (2026-08-06): отзывает ВСЕ живые сессии пользователя как часть той же
        // транзакции — форс ре-логин на всех устройствах после смены логин-email.
        public async Task<MessageResultModel> ConfirmEmailChangeAsync(ConfirmEmailChangeModel model, CancellationToken cancellationToken = default)
        {
            var request = await EmailChangeRequestRepository.AsQueryable()
                                                             .Include(x => x.User)
                                                             .SingleOrDefaultAsync(x => x.NewEmailToken == model.Token, cancellationToken);

            var now = DateTime.UtcNow;
            if (request is null || request.UsedAtUtc.HasValue || request.PendingNewEmail is null ||
                !request.NewEmailExpiresAtUtc.HasValue || request.NewEmailExpiresAtUtc.Value <= now)
                throw EmailChangeLinkInvalid();

            // Race-guard (спека B8): адрес мог быть занят другим пользователем между шагом 3
            // и переходом по ссылке.
            var emailTaken = await UserRepository.AsQueryable()
                                                 .AnyAsync(x => x.Email == request.PendingNewEmail && !x.IsDeleted && x.Id != request.UserId, cancellationToken);
            if (emailTaken)
                throw EmailAlreadyTaken();

            using var transaction = TransactionsHelper.CreateAsyncTransactionScope();

            request.User.Email = request.PendingNewEmail;
            request.UsedAtUtc = now;

            // Форс ре-логин на всех устройствах (решение Давида, 2026-08-06) — тот же приём,
            // что уже использует ResetPasswordAsync.
            await RevokeAllRefreshTokensAsync(request.UserId, now, null, null, cancellationToken);

            await UserRepository.SaveChangesAsync(cancellationToken);
            transaction.Complete();

            return new MessageResultModel { Message = EmailChangedMessage };
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

        // Общий путь переотправки письма подтверждения для Register (повторная отправка
        // формы) и ResendVerificationEmailAsync — семантика токена одна и та же
        // (перезапись строки по (UserId, Type), ADR 006), новых правил гашения не вводим.
        private async Task<MessageResultModel> ResendEmailVerificationAsync(User user, RequestContextModel requestContext, CancellationToken cancellationToken)
        {
            var existingToken = await UserTokenRepository.AsQueryable()
                                                         .SingleOrDefaultAsync(x => x.UserId == user.Id && x.Type == UserTokenType.EmailVerification, cancellationToken);

            // Кулдаун 60с (2026-08-27) против спама письмами с чужого адреса. Ответ при
            // этом тот же generic, что и при реальной отправке: отдельная ошибка или
            // другой текст сами по себе подтверждали бы, что аккаунт существует и ждёт
            // подтверждения.
            if (existingToken is not null &&
                existingToken.RequestedAtUtc.AddSeconds(ResendVerificationCooldownSeconds) > DateTime.UtcNow)
                return GenericEmailSent(null);

            var verificationToken = await UpsertUserTokenAsync(user, UserTokenType.EmailVerification, requestContext, cancellationToken);
            await SendAuthEmailAsync(NotificationTemplateTrigger.VerifyEmail, user.Email, user.FirstName,
                new Dictionary<string, string>
                {
                    [NotificationAuthPlaceholders.UserName] = user.FirstName,
                    [NotificationAuthPlaceholders.VerifyUrl] = EmailMessageFactory.BuildVerifyUrl(emailSettings, verificationToken)
                }, cancellationToken);

            return GenericEmailSent(verificationToken);
        }

        // Общий путь «выпустить токен сброса и отправить письмо» для самообслуживания
        // (ForgotPasswordAsync) и админского сценария (SendPasswordResetEmailAsync).
        // Различаются они только тем, как найден пользователь и что уходит в ответ.
        private async Task<string> IssuePasswordResetTokenAsync(User user, RequestContextModel requestContext, CancellationToken cancellationToken)
        {
            var resetToken = await UpsertUserTokenAsync(user, UserTokenType.PasswordReset, requestContext, cancellationToken);
            await SendAuthEmailAsync(NotificationTemplateTrigger.ResetPassword, user.Email, user.FirstName,
                new Dictionary<string, string>
                {
                    [NotificationAuthPlaceholders.UserName] = user.FirstName,
                    [NotificationAuthPlaceholders.ResetUrl] = EmailMessageFactory.BuildResetUrl(emailSettings, resetToken)
                }, cancellationToken);

            return resetToken;
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
        // spareImpersonationByUserId: щадит РОВНО ту строку, что сама является impersonation-
        // сессией ЭТОГО актёра над userId (см. RevokeAllUserSessionsAsync). Null везде, кроме
        // того единственного вызова — остальные вызовы этого параметра не знают и не должны.
        private async Task RevokeAllRefreshTokensAsync(int userId, DateTime revokedAtUtc, string? keptTokenHash,
            int? spareImpersonationByUserId, CancellationToken cancellationToken)
        {
            var activeTokens = await RefreshTokenRepository.AsQueryable()
                                                           .Where(x => x.UserId == userId && x.RevokedAtUtc == null)
                                                           .ToListAsync(cancellationToken);

            foreach (var activeToken in activeTokens)
            {
                if (keptTokenHash is not null && activeToken.TokenHash == keptTokenHash)
                    continue;

                if (spareImpersonationByUserId is not null && activeToken.ImpersonatedByUserId == spareImpersonationByUserId)
                    continue;

                activeToken.RevokedAtUtc = revokedAtUtc;

                // Тот же мгновенный отзыв access-токена, что и в RevokeSessionAsync (David,
                // 2026-08-31), — по TokenHash ИМЕННО ЭТОЙ строки, не по userId. Покрывает разом
                // все вызовы этого метода: «Завершить остальные сеансы», смену пароля,
                // принудительный логаут админом. keptTokenHash уже исключил сессию вызывающего
                // выше — под отзыв идут только реально гашенные токены.
                sessionRevocationRegistry.Revoke(activeToken.TokenHash, revokedAtUtc,
                    revokedAtUtc.AddMinutes(JwtSettings.Instance.AccessTokenMinutes));
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

        // Догоняющая ротация для прощённой гонки (ADR 033, случай 1). Отдать вызывающему тот
        // самый токен-преемник нельзя — в БД лежит только его ХЕШ, а plaintext был выдан
        // устройству, которое выиграло гонку, и здесь неизвестен. Поэтому живую голову
        // цепочки продвигаем ещё на один шаг и отдаём вызывающему уже новый токен: оба
        // устройства остаются в сессии, а цепочка при этом не ветвится.
        //
        // Свойства сессии (RememberMe, ImpersonatedByUserId) переносятся с ГОЛОВЫ, а не с
        // предъявленного токена: актуальное состояние цепочки — именно у неё.
        private async Task<RefreshOutcome> CatchUpRotationAsync(RefreshToken storedToken, RefreshToken head,
            DateTime now, RequestContextModel requestContext, CancellationToken cancellationToken)
        {
            // Те же три проверки, что и в обычной ротации, и в том же порядке — прощённая
            // гонка не должна быть лазейкой: без этого блокировка/удаление/деверификация
            // аккаунта ровно в 10-секундное окно после ротации давали бы устройству ещё
            // один access-токен в обход только что принятого решения. Гасим ГОЛОВУ (живой
            // конец цепочки) — predъявленный storedToken уже отозван ротацией.
            var user = storedToken.User;

            if (user.IsDeleted)
                throw await RevokeAndRejectAsync(head, now, GlobalErrorCode.AccountDeleted,
                    "Account has been deleted.", cancellationToken);

            if (user.LockedUntil.HasValue && user.LockedUntil.Value > now)
                throw await RevokeAndRejectAsync(head, now, GlobalErrorCode.AccountLocked,
                    "Account is temporarily locked.", cancellationToken);

            if (!user.IsEmailVerified)
                throw await RevokeAndRejectAsync(head, now, GlobalErrorCode.EmailNotVerified,
                    "Email is not verified.", cancellationToken);

            var minted = jwtTokenService.CreateRefreshToken(head.RememberMe);

            head.RevokedAtUtc = now;
            head.ReplacedByTokenHash = minted.TokenHash;

            await RefreshTokenRepository.AddAsync(new RefreshToken
            {
                UserId = head.UserId,
                TokenHash = minted.TokenHash,
                ExpiresAtUtc = minted.ExpiresAtUtc,
                CreatedAtUtc = now,
                CreatedByIp = requestContext.IpAddress,
                CreatedByUserAgent = requestContext.UserAgent,
                RememberMe = head.RememberMe,
                ImpersonatedByUserId = head.ImpersonatedByUserId
            }, cancellationToken);

            await RefreshTokenRepository.SaveChangesAsync(cancellationToken);

            // Пользователь у предъявленного токена и у головы один и тот же (голова — его
            // прямой преемник), но Include(User) есть только у storedToken — по нему и
            // резолвим права, как в обычной ротации.
            var accessToken = jwtTokenService.CreateAccessToken(storedToken.User,
                await ResolvePermissionsAsync(storedToken.User, cancellationToken),
                minted.TokenHash,
                head.ImpersonatedByUserId);

            return new RefreshOutcome(accessToken,
                new IssuedRefreshToken(minted.Token, minted.ExpiresAtUtc, head.RememberMe));
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

        private static ErrorModelException EmailChangeCodeInvalid()
            => new(GlobalErrorCode.EmailChangeCodeInvalid, HttpStatusCode.BadRequest, "Email change code is invalid or expired.");

        private static ErrorModelException EmailChangeLinkInvalid()
            => new(GlobalErrorCode.EmailChangeLinkInvalid, HttpStatusCode.BadRequest, "Email change link is invalid or expired.");

        private static ErrorModelException EmailAlreadyTaken()
            => new(GlobalErrorCode.EmailAlreadyTaken, HttpStatusCode.BadRequest, "This email address is already taken.");

        #endregion
    }
}
