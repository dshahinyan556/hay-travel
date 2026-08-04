# ADR 006. Единый `UserToken` (verify + reset) с полем `Type`; refresh-токены — отдельная таблица

- **Дата:** 2026-08-02
- **Статус:** Accepted (пункт про переименование `PasswordRecovery` — требует финального «да»
  Давида, т.к. таблица уже накатана на Azure, см. «Последствия»)
- **Контекст этапа:** аутентификация/авторизация

## Контекст

Нужны два сценария по email через одну ссылку-с-токеном: verify-email при регистрации и
password recovery (решение Давида — механизм единый). В БД уже есть таблица `PasswordRecovery`
(Id/UserId-unique/Token-unique/RequestedAtUtc/RequestIp/UserAgent/ExpiresAtUtc/UsedAtUtc), один
активный запрос на юзера. Таблица накатана на dev и Azure, но **пустая** (пользователей ещё нет).

Отдельно нужен refresh-токен (~14 дней) в httpOnly-cookie с ротацией и инвалидацией.

## Варианты (email-токен)

1. Вторая таблица `EmailVerificationToken` — зеркало `PasswordRecovery`. Механизм фактически
   дублируется (две таблицы, два токен-сервиса).
2. Обобщить `PasswordRecovery` → `UserToken` + `Type` (`UserTokenType { EmailVerification=1,
   PasswordReset=2 }`), уникальный индекс `(UserId, Type)` вместо `UserId`. Один активный токен
   на цель на юзера, логика генерации/валидации/протухания/погашения пишется один раз.

## Решение

- **Email-токен:** вариант 2 — единая таблица `UserToken` с `Type`. Это буквально «единый
  механизм», которого просил Давид. Nav на `User` меняется с 1:1 `PasswordRecovery` на
  `ICollection<UserToken> Tokens` (максимум 2 строки: по одной на `Type`). «Новый перезаписывает
  старый» — сервис при выдаче удаляет/переписывает существующую строку того же `Type`.
- **Refresh-токен:** НЕ в `UserToken`. Отдельная таблица `RefreshToken`
  (Id/UserId/TokenHash-unique/ExpiresAtUtc/CreatedAtUtc/CreatedByIp?/RevokedAtUtc?/ReplacedByTokenHash?).
  Хранится только SHA-256 **хеш** токена, не plaintext.

## Обоснование

- Verify и reset — короткоживущие (TTL 1 час), ровно один активный на цель: модель
  `(UserId, Type)`-unique им идеально подходит, и объединение убирает дублирование кода.
- Refresh-токены живут по другим правилам: их может быть несколько одновременно (разные
  устройства/сессии), они длинные (14 дней), с ротацией и цепочкой замены и reuse-detection.
  Впихивать их в `(UserId, Type)`-unique `UserToken` (=строго один) сломало бы мульти-сессию.
  Поэтому — своя таблица, заточенная под ротацию.
- Обобщение дешёвое: `PasswordRecovery` пустая, `RenameTable` + добавление `Type` + смена
  индекса не теряет данные.

## Последствия

- Переименование `PasswordRecovery` → `UserToken` затрагивает: Entity, EntityConfiguration,
  `ATToursContext` DbSet, nav-свойство `User`, миграцию, snapshot и **уже применённую Azure-БД**.
  Таблица пустая, риск данных нулевой, но это правка «устоявшейся» схемы из user-management.md —
  финальное «да» на переименование за Давидом. Fallback без переименования: оставить
  `PasswordRecovery` под reset и завести параллельную `EmailVerificationToken` — контракт
  эндпоинтов при этом не меняется, меняется только слой хранения.
- `User.PasswordRecovery` (1:1) исчезает; появляется `User.Tokens` (1:many) и `User.RefreshTokens`.
- Успешный reset (контракт из user-management.md: погасить токен + обнулить
  `FailedLoginAttempts`/`LockedUntil`/`ForceToChangePass`) дополнительно **отзывает все
  refresh-токены** пользователя — вынужденный ре-логин на всех устройствах после смены пароля.
