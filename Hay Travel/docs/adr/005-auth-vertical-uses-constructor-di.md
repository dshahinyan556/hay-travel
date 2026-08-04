# ADR 005. Auth-вертикаль использует конструкторный DI, а не `new XxxService()`

- **Дата:** 2026-08-02
- **Статус:** Accepted
- **Контекст этапа:** аутентификация/авторизация (первая врезка auth в проект)

## Контекст

Во всём проекте контроллеры создают сервисы вручную (`using var s = new TourCreationService(entity)`),
DI-контейнером инъектируется только `IMapper`; `AddServices()`/`AddDAL()` — пустые заглушки.
Сервисы сами берут строку подключения из `CommonSettings.Instance.ATToursConnectionString`
и поднимают `ATToursContextFactory` внутри.

Требование Давида по email: `IEmailSender` должен иметь две реализации (`DevEmailSender`,
`SendGridEmailSender`), и DI-контейнер обязан **сам выбрать** реализацию по наличию конфига
(API-key SendGrid). Такой выбор реализации по конфигу — ровно то, для чего существует DI, и
он не выражается через `new`.

## Варианты

1. Оставить `new`-паттерн и выбирать `IEmailSender` статической фабрикой
   (`EmailSenderFactory.Resolve()` читает конфиг) — консистентно с тем, как сервисы уже читают
   `CommonSettings.Instance`.
2. Ввести конструкторный DI только для auth-вертикали: `AuthController` инъектит `IAuthService`,
   который инъектит `IEmailSender` / `IJwtTokenService` / `IPasswordHasher`.

## Решение

Вариант 2 — но точечно, только для auth. `TourController` и остальные вертикали не трогаем.

- `AuthController` и `UsersController` получают сервисы через конструктор (как уже получают
  `IMapper`).
- `IAuthService` (и коллабораторы `IEmailSender`/`IJwtTokenService`/`IPasswordHasher`)
  регистрируются в `AddServices()` внутри `ATTours.ClientAPI/DependencyInjection`.
- Доступ к БД внутри `AuthService` остаётся **тем же**, что у сервисов-соседей: свой
  `ATToursContextFactory` + repository-core по строке из `CommonSettings`. DI управляет только
  композицией кросс-каттинг коллабораторов, не жизненным циклом `DbContext`.

## Обоснование

- Config-based выбор `IEmailSender` — каноничный сценарий DI; статическая фабрика (вариант 1)
  воспроизводила бы контейнер руками и хуже тестируется.
- `IJwtTokenService`/`IPasswordHasher` — stateless синглтоны без БД; держать их за `new` внутри
  сервиса значило бы зашивать выбор алгоритма/ключа в код.
- Точечность: не переписываем работающие `new`-вертикали ради единообразия — это отдельная,
  не требуемая задачей миграция. Divergence осознанная и ограничена auth.

## Последствия

- Появляется два стиля создания сервисов в проекте (DI для auth, `new` для остального) — это
  зафиксированный, а не случайный разнобой; при будущем переезде вертикалей на DI auth уже готов.
- `AddServices()` перестаёт быть пустым: там живёт вся регистрация auth-графа и config-selection
  `IEmailSender` (`AddSingleton<IEmailSender>(sp => hasSendGridKey ? new SendGridEmailSender(...) : new DevEmailSender(...))`).
