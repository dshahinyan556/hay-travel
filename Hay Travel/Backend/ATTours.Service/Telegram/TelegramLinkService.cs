using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.Security;
using ATTours.BusinessServices.Services.AuthServices;
using ATTours.Common.DTO.Account;
using ATTours.Common.DTO.Telegram;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.ContextRepository.RepositoryAbstraction.Relational;
using ATTours.ContextRepository.RepositoryImplementation.Relational;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Net;

namespace ATTours.BusinessServices.Telegram
{
    // Привязка аккаунта к чату HayTravelNotificationsBot (ADR 031 §4).
    //
    // Доступ к БД — как у AuthService: собственный контекст по строке из CommonSettings,
    // из DI приходят только коллабораторы (ADR 005). Scoped — живёт запрос и освобождается
    // вместе с ним.
    //
    // Своей машины одноразовых кодов здесь нет: переиспользуется UserToken
    // (UserTokenType.TelegramLink) с тем же upsert по (UserId, Type) и той же проверкой
    // UsedAtUtc/ExpiresAtUtc, что у verify-email/password-reset.
    public class TelegramLinkService : RepositoryCoreBase<User, ATToursContextFactory>, ITelegramLinkService
    {
        private const string StartCommand = "/start";

        // Ответы бота на /start. Двуязычность здесь не нужна: до привязки пользователь ещё
        // не идентифицирован, спросить PreferredLanguage не у кого — RU по умолчанию,
        // консистентно с остальными системными сообщениями (решение архитектора, ADR 031 §4).
        private const string LinkedReply = "Аккаунт привязан. Уведомления Hay Travel будут приходить в этот чат.";
        private const string InvalidCodeReply = "Код недействителен или истёк. Запросите новый в личном кабинете Hay Travel.";

        private readonly TelegramSettings settings;
        private readonly ILogger<TelegramLinkService> logger;

        public TelegramLinkService(TelegramSettings settings, ILogger<TelegramLinkService> logger)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.settings = settings;
            this.logger = logger;
        }

        #region Repositories

        private IEntityRepository<User> UserRepository => EntityRepository;

        private IEntityRepository<UserToken>? userTokenRepository;
        private IEntityRepository<UserToken> UserTokenRepository => userTokenRepository ??= new EntityRepository<UserToken>(Context);

        #endregion

        public async Task<TelegramLinkCodeModel> IssueLinkCodeAsync(int userId, RequestContextModel requestContext,
            CancellationToken cancellationToken = default)
        {
            // Без настроенного бота код бессмыслен: пользователь получил бы рабочую на вид
            // ссылку на молчащего бота и ждал бы ответа, которого не будет.
            if (!settings.IsConfigured)
                throw new ErrorModelException(GlobalErrorCode.TelegramNotConfigured, HttpStatusCode.ServiceUnavailable,
                    "Telegram bot is not configured (Telegram:BotToken / Telegram:WebhookSecret are empty).");

            var user = await LoadUserAsync(userId, cancellationToken);

            var code = RandomTokenGenerator.CreateDeepLinkCode();
            var now = DateTime.UtcNow;
            var expiresAtUtc = now.AddMinutes(settings.LinkCodeLifetimeMinutes);

            // Один активный код на пользователя: существующая строка переписывается
            // (ADR 006) — повторный запрос из профиля обесценивает предыдущий код.
            var existingToken = await UserTokenRepository.AsQueryable()
                                                         .SingleOrDefaultAsync(x => x.UserId == user.Id
                                                                                    && x.Type == UserTokenType.TelegramLink,
                                                                               cancellationToken);

            if (existingToken is null)
            {
                await UserTokenRepository.AddAsync(new UserToken
                {
                    UserId = user.Id,
                    Type = UserTokenType.TelegramLink,
                    Token = code,
                    RequestedAtUtc = now,
                    // RequestIp — NOT NULL в UserTokenConfiguration, общая колонка всех
                    // одноразовых токенов. Пропуск этих полей ронял INSERT SqlException'ом,
                    // который MsSqlContextExceptionHandlerChain отдавал наружу как 400, —
                    // выдать код было нельзя вообще (баг найден на проде 2026-08-29).
                    RequestIp = requestContext.IpAddress,
                    UserAgent = requestContext.UserAgent,
                    ExpiresAtUtc = expiresAtUtc
                }, cancellationToken);
            }
            else
            {
                existingToken.Token = code;
                existingToken.RequestedAtUtc = now;
                existingToken.RequestIp = requestContext.IpAddress;
                existingToken.UserAgent = requestContext.UserAgent;
                existingToken.ExpiresAtUtc = expiresAtUtc;
                existingToken.UsedAtUtc = null;
            }

            await UserTokenRepository.SaveChangesAsync(cancellationToken);

            return new TelegramLinkCodeModel
            {
                DeepLinkUrl = $"{settings.DeepLinkBase}?start={code}",
                Code = code,
                ExpiresAtUtc = expiresAtUtc
            };
        }

        public async Task<TelegramLinkStatusModel> GetStatusAsync(int userId, CancellationToken cancellationToken = default)
        {
            var user = await LoadUserAsync(userId, cancellationToken);

            return ToStatus(user);
        }

        public async Task UnlinkAsync(int userId, CancellationToken cancellationToken = default)
        {
            var user = await LoadUserAsync(userId, cancellationToken);

            // Отвязка идемпотентна: у непривязанного пользователя обнулять нечего, и это
            // не ошибка — повторный DELETE отвечает так же, как первый.
            user.TelegramChatId = null;
            user.TelegramUsername = null;

            await UserRepository.SaveChangesAsync(cancellationToken);
        }

        public async Task<TelegramUpdateResult> HandleUpdateAsync(TelegramUpdateModel update,
            CancellationToken cancellationToken = default)
        {
            var message = update?.Message;
            var text = message?.Text?.Trim();

            // Всё, кроме "/start <код>", бот игнорирует: меню и интерактива у него нет
            // (ADR 031). Пустой результат -> контроллер ничего не отвечает, но всё равно
            // возвращает 200, иначе Telegram будет ретраить этот апдейт.
            if (message?.Chat is null || string.IsNullOrEmpty(text)
                || !text.StartsWith(StartCommand + " ", StringComparison.Ordinal))
            {
                logger.LogDebug("Telegram update {UpdateId} is not a link command; ignored.", update?.UpdateId);
                return new TelegramUpdateResult();
            }

            var chatId = message.Chat.Id;
            var code = text[(StartCommand.Length + 1)..].Trim();

            var token = await FindUsableTokenAsync(code, cancellationToken);

            if (token?.User is null || token.User.IsDeleted)
            {
                logger.LogInformation("Telegram link code from chat {ChatId} is invalid, expired or already used.", chatId);
                return new TelegramUpdateResult { ChatId = chatId, ReplyText = InvalidCodeReply };
            }

            // Один чат ↔ один пользователь (filtered-unique-индекс). Прежнюю привязку этого
            // чата снимаем здесь, а не полагаемся на SqlException: иначе перепривязка чата
            // на другой аккаунт падала бы 500-й, хотя это легальный сценарий.
            var previouslyLinked = await UserRepository.AsQueryable()
                                                       .Where(x => x.TelegramChatId == chatId && x.Id != token.UserId)
                                                       .ToListAsync(cancellationToken);

            foreach (var user in previouslyLinked)
            {
                logger.LogInformation("Telegram chat {ChatId} was linked to user {UserId}; re-linked to user {NewUserId}.",
                    chatId, user.Id, token.UserId);

                user.TelegramChatId = null;
                user.TelegramUsername = null;
            }

            token.User.TelegramChatId = chatId;
            token.User.TelegramUsername = Normalize(message.From?.Username);
            token.UsedAtUtc = DateTime.UtcNow;

            await UserTokenRepository.SaveChangesAsync(cancellationToken);

            logger.LogInformation("User {UserId} linked Telegram chat {ChatId}.", token.UserId, chatId);

            return new TelegramUpdateResult { ChatId = chatId, ReplyText = LinkedReply };
        }

        // Активный (непогашенный и непросроченный) код привязки вместе с владельцем —
        // тот же lookup, что у verify/reset (AuthService.FindUsableTokenAsync).
        private async Task<UserToken?> FindUsableTokenAsync(string code, CancellationToken cancellationToken)
        {
            var storedToken = await UserTokenRepository.AsQueryable()
                                                       .Include(x => x.User)
                                                       .SingleOrDefaultAsync(x => x.Token == code
                                                                                  && x.Type == UserTokenType.TelegramLink,
                                                                             cancellationToken);

            if (storedToken is null || storedToken.UsedAtUtc.HasValue || storedToken.ExpiresAtUtc <= DateTime.UtcNow)
                return null;

            return storedToken;
        }

        // !IsDeleted: удалённый пользователь отвечает 404, как и несуществующий (тот же
        // приём, что в UserPhoneUpdateService).
        private async Task<User> LoadUserAsync(int userId, CancellationToken cancellationToken)
        {
            return await UserRepository.AsQueryable()
                                       .SingleOrDefaultAsync(x => x.Id == userId && !x.IsDeleted, cancellationToken)
                   ?? throw new ErrorModelException(GlobalErrorCode.RelationalEntityNotFound, HttpStatusCode.NotFound,
                       $"User with id {userId} not found.");
        }

        private static TelegramLinkStatusModel ToStatus(User user)
            => new()
            {
                IsLinked = user.TelegramChatId is not null,
                TelegramUsername = user.TelegramUsername
            };

        // Telegram отдаёт username без "@" и не длиннее 32 символов, но поле приходит
        // снаружи — обрезаем под фактическую ширину колонки, чтобы привязка не падала
        // SqlException'ом на подделанном апдейте.
        private static string? Normalize(string? username)
        {
            var trimmed = username?.Trim();

            if (string.IsNullOrEmpty(trimmed))
                return null;

            return trimmed.Length > 32 ? trimmed[..32] : trimmed;
        }
    }
}
