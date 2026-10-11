using ATTours.Common.DTO.Auth;
using ATTours.Common.DTO.Authorization;
using ATTours.Common.Entities;

namespace ATTours.BusinessServices.Services.AuthServices
{
    public interface IAuthService
    {
        // Существующий email не отличим по ответу от нового: возвращается то же
        // generic-сообщение, а неверифицированному аккаунту повторно уходит письмо.
        Task<MessageResultModel> RegisterAsync(RegisterModel model, RequestContextModel requestContext, CancellationToken cancellationToken = default);

        // Повторная отправка письма подтверждения (2026-08-27) — раньше её заменяла только
        // повторная отправка всей формы регистрации. Ответ всегда generic: несуществующий
        // адрес, уже подтверждённый и попавший в 60-секундный кулдаун неотличимы.
        Task<MessageResultModel> ResendVerificationEmailAsync(ResendVerificationModel model, RequestContextModel requestContext, CancellationToken cancellationToken = default);

        Task<MessageResultModel> VerifyEmailAsync(VerifyEmailModel model, CancellationToken cancellationToken = default);

        Task<LoginOutcome> LoginAsync(LoginModel model, RequestContextModel requestContext, CancellationToken cancellationToken = default);

        // Дев-бэкдор для локального UI-тестирования (Давид, 2026-08-16): та же выдача
        // токенов, что и LoginAsync, но БЕЗ проверки пароля/блокировки/верификации почты.
        // Контроллер обязан гейтить вызов IWebHostEnvironment.IsDevelopment() — этот метод
        // сам такую проверку не делает, чтобы не тащить IWebHostEnvironment в Service-слой.
        Task<LoginOutcome> DevLoginAsync(string usernameOrEmail, RequestContextModel requestContext, CancellationToken cancellationToken = default);

        // Ротация с reuse-detection и окном прощения гонки (ADR 033): предъявленный уже
        // отозванный токен гасит ВСЕ сессии пользователя только если это настоящий reuse.
        // Ротационная гонка внутри окна прощается догоняющей ротацией, а явно погашенный
        // токен (logout/отзыв сессии/смена пароля) просто отклоняется, без гашения семьи.
        Task<RefreshOutcome> RefreshAsync(string? refreshToken, RequestContextModel requestContext, CancellationToken cancellationToken = default);

        // Идемпотентен: отсутствующий/уже отозванный токен — не ошибка.
        Task LogoutAsync(string? refreshToken, CancellationToken cancellationToken = default);

        // Управление сессиями/устройствами (spec 017 §4). И чтение, и отзыв живут в
        // AuthService, а не в отдельном Info-сервисе: запись по RefreshToken — его домен
        // (ADR 005/028), и здесь же уже есть хеширование токена и geo-lookup.
        //
        // currentRefreshToken — plaintext из cookie вызывающего: по его хешу помечается
        // IsCurrent и сохраняется текущая сессия при отзыве остальных. null допустим.
        Task<List<SessionInfoModel>> GetMySessionsAsync(int userId, string? currentRefreshToken, CancellationToken cancellationToken = default);

        // Отзыв одной своей сессии. Чужая (или несуществующая) строка — 404
        // RelationalEntityNotFound; уже отозванная — no-op.
        Task RevokeMySessionAsync(int userId, int sessionId, CancellationToken cancellationToken = default);

        // «Выйти на других устройствах»: текущая сессия переживает отзыв (как при
        // ChangePasswordAsync).
        Task RevokeMyOtherSessionsAsync(int userId, string? currentRefreshToken, CancellationToken cancellationToken = default);

        // Админские аналоги тех же операций (гейтятся правами экрана «Пользователи»).
        // IsCurrent в списке всегда false: админ смотрит чужие сессии.
        Task<List<SessionInfoModel>> GetUserSessionsAsync(int targetUserId, CancellationToken cancellationToken = default);

        Task RevokeUserSessionAsync(int targetUserId, int sessionId, CancellationToken cancellationToken = default);

        // Гасит ВСЕ сессии цели, включая её текущую: админ не залогинен как цель, сохранять
        // здесь нечего. Кроме одной: actingUserId — сам вызывающий админ, чья СОБСТВЕННАЯ
        // impersonation-сессия над этой же целью щадится (David, 2026-08-29), иначе кнопка
        // сносит и рабочий сеанс того, кто её нажал.
        Task RevokeAllUserSessionsAsync(int targetUserId, int actingUserId, CancellationToken cancellationToken = default);

        // «Войти как пользователь» (spec 014 §3, ADR 028/030). Односторонняя операция:
        // ВСЕ сессии вызывающего отзываются, его уже выданные access-токены мгновенно
        // объявляются недействительными, а наружу уходит сессия цели. Обратного эндпоинта
        // нет — выход = обычный logout и повторный вход.
        //
        // actingUserId берётся из токена, targetUserId — из маршрута (никогда из тела).
        // Право на вызов проверяет [RequiresImpersonate] в ClientAPI; здесь проверяются
        // эскалация привилегий и пригодность самой цели — заблокированную или с
        // неподтверждённой почтой учётку impersonate'ить нельзя (по данным БД, не по claim'ам).
        Task<LoginOutcome> ImpersonateAsync(int actingUserId, int targetUserId,
            RequestContextModel requestContext, CancellationToken cancellationToken = default);

        // Резолвленный (роль + персональный override) набор прав текущего пользователя —
        // контракт гардов админки (architecture-flexible-roles.md §4.1). Всегда свежий из
        // БД, в отличие от запечённого в access-токене.
        Task<MyPermissionsModel> GetMyPermissionsAsync(int userId, CancellationToken cancellationToken = default);

        // Всегда generic-ответ, независимо от того, существует ли аккаунт.
        Task<MessageResultModel> ForgotPasswordAsync(ForgotPasswordModel model, RequestContextModel requestContext, CancellationToken cancellationToken = default);

        // Админ-инициированная отправка письма о сбросе пароля (2026-08-27): тот же выпуск
        // токена и то же письмо, что в ForgotPasswordAsync, но без поиска по введённому
        // адресу и без анти-энумерации — цель уже найдена и проверена вызывающим сервисом
        // (UserAdminPasswordResetService: 404 на удалённого, SuperAdmin-guard).
        Task<MessageResultModel> SendPasswordResetEmailAsync(User user, RequestContextModel requestContext, CancellationToken cancellationToken = default);

        Task<MessageResultModel> ResetPasswordAsync(ResetPasswordModel model, CancellationToken cancellationToken = default);

        // currentRefreshToken — plaintext из cookie: эта сессия переживает смену пароля,
        // остальные отзываются. null допустим (тогда отзываются все).
        Task<MessageResultModel> ChangePasswordAsync(int userId, ChangePasswordModel model, string? currentRefreshToken, CancellationToken cancellationToken = default);

        // Email-change flow (B8, 2026-08-06). Шаг 1: код на ТЕКУЩИЙ email. Каждый вызов
        // начинает флоу заново (апсерт по UserId, хвосты прошлой попытки сбрасываются).
        Task<MessageResultModel> RequestEmailChangeAsync(int userId, RequestContextModel requestContext, CancellationToken cancellationToken = default);

        // Шаг 2: подтверждение кода, присланного на старый email.
        Task<MessageResultModel> ConfirmEmailChangeCodeAsync(int userId, ConfirmEmailChangeCodeModel model, CancellationToken cancellationToken = default);

        // Шаг 3: новый email. Требует свежего OldEmailConfirmedAtUtc. В отличие от Register,
        // занятый адрес отвечает явной ошибкой (решение Давида, 2026-08-06) — пользователь
        // уже аутентифицирован, анти-энумерация здесь неприменима.
        Task<MessageResultModel> RequestNewEmailAsync(int userId, RequestNewEmailModel model, RequestContextModel requestContext, CancellationToken cancellationToken = default);

        // Шаг 4: переход по ссылке из письма на новый email — AllowAnonymous. Отзывает все
        // живые сессии пользователя (решение Давида, 2026-08-06).
        Task<MessageResultModel> ConfirmEmailChangeAsync(ConfirmEmailChangeModel model, CancellationToken cancellationToken = default);
    }
}
