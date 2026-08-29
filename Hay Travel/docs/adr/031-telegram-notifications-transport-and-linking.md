# ADR 031 — Telegram-уведомления: транспорт, привязка аккаунта, границы дублирования email

Дата: 2026-08-28
Статус: Accepted
Связанная спецификация: [specs/015-telegram-notifications-backend.md](../specs/015-telegram-notifications-backend.md)
Контекст модели: `architecture-notification-recipients-multi-employee.md` §0.3 («Реальная
отправка в Telegram — только модель и настройки», ранее вне скоупа — этой задачей закрывается).

## Контекст

Коммит `e05a8b5` завёл модель уведомлений с платформой `Telegram` (enum
`NotificationPlatform.Telegram = 2`, `NotificationRecipient`/`NotificationChannel` уже её
хранят, `NotificationSettingsValidationService` уже ограничивает Telegram-получателей
источниками `User`/`OrderLinked`), но реальной отправки нет: `OrderNotificationService`
резолвит и шлёт только `NotificationPlatform.Email`, а `NotificationSettingsInfo`
помечает Telegram как `IsImplemented = false`.

Бот `HayTravelNotificationsBot` служит ТОЛЬКО для дублирования email-уведомлений в Telegram.
Никакого меню/интерактива, кроме минимальной привязки аккаунта. Продуктовые решения
(webhook, не polling; deep-link `?start=<код>`; секреты в конфиге; chat id в БД) уже приняты
Давидом и здесь не пересматриваются — фиксируется только техническая архитектура их
исполнения.

## Решения

### 1. Транспорт — чистый `HttpClient` POST к Bot API, НЕ NuGet `Telegram.Bot`

`ITelegramSender` реализуется тем же паттерном, что `BrevoEmailSender`/`SendGridEmailSender`:
`HttpClient.PostAsJsonAsync` к `https://api.telegram.org/bot<token>/sendMessage`, ошибки
провайдера глотаются и логируются (не роняют операцию), реализация выбирается в DI по конфигу
(`IsConfigured ? TelegramApiSender : DevTelegramSender`).

Почему не `Telegram.Bot`:
- Бот send-only + один webhook. Реально используются 2 метода Bot API: `sendMessage` (исходящее)
  и опционально `setWebhook` (разовая регистрация, делается вручную через curl). `Telegram.Bot`
  тянет polling/диспетчеризацию апдейтов/клавиатуры/файлы — 95% поверхности не нужно.
- Полная симметрия с уже работающим стеком `IEmailSender`: разработчик, читавший
  `BrevoEmailSender`, читает `TelegramApiSender` без новой ментальной модели (тот же
  `AddHttpClient(nameof(...))`, тот же `PostAsync` со swallow-and-log).
- Входящий webhook разбирает крошечный срез JSON апдейта (`message.text`, `message.chat.id`,
  `message.from.username`) — свой минимальный DTO прозрачнее и дешевле, чем модель `Update` из
  `Telegram.Bot`.
- Референс `AnonymBot.TelegramBot` использует `Telegram.Bot` потому, что это интерактивный
  consumer-бот с меню, — другая форма задачи, не наш случай (и там же токен захардкожен
  открытым текстом — антипаттерн, не воспроизводим).

Точка пересмотра: если бот когда-нибудь обрастёт реальным меню/inline-клавиатурой — тогда
и переходить на `Telegram.Bot`, не раньше.

### 2. Содержимое Telegram-сообщения — plaintext, собранный бэкендом, НЕ рендер admin-HTML-шаблона

Email-письмо рендерится из `EmailTemplate` (билингвальные Subject/BodyHtml с плейсхолдерами,
редактируется админом). У Telegram шаблона в модели нет и не будет: `NotificationSettingsInfo`
осознанно возвращает `Template = null` для платформы Telegram.

Telegram-текст собирается бэкендом из того же события (`EmailActionKey`) и того же
`OrderNotificationContext`, локализованно (`NotificationLabels`), как короткий plaintext
(`parse_mode=HTML` с ограниченным набором тегов Telegram), — а НЕ конвертацией
HTML-тела письма.

Почему:
- Admin-HTML письма (таблицы/`<p>`/инлайн-стили) в Telegram выглядел бы сломанным: `sendMessage`
  поддерживает лишь узкий whitelist HTML-тегов.
- Городить второй шаблонизатор (Telegram-версии тем/тел в БД) — вне скоупа «минимального
  дублирования» и противоречит модели (у Telegram нет `Template`).
- Это ровно тот же подход, что у plaintext auth-писем (`EmailMessageFactory`): текст, которым
  админ не управляет, живёт в коде. «Дублирование» здесь означает те же события, тех же
  получателей-пользователей и тот же язык — не побайтовую копию HTML.

Точка расширения: если позже понадобится админ-редактируемый Telegram-текст или
HTML→text-конвертация — добавляется отдельным шагом.

### 3. Доставка синхронная, в одном ряду с email — без выделения Telegram в фон

`OrderNotificationService.DispatchAsync` после email-пути выполняет Telegram-путь тем же
`await` в потоке запроса. И email-, и Telegram-транспорт уже глотают сбои провайдера
(swallow-and-log), поэтому медленный/недоступный Telegram не роняет оформленную бронь, но
добавляет латентность запросу — так же, как сейчас это делает email.

Осознанно НЕ выносим Telegram в фоновый outbox в этой задаче: единственная причина
отклоняться от синхронного email-паттерна — латентность, и если она станет проблемой, в фон
переезжают ОБА канала вместе (единый outbox), а не только Telegram. Расщеплять консистентность
ради одного канала — хуже, чем ровный синхронный путь.

### 4. Код привязки — переиспользуем `UserToken`, а не новые колонки-код на `User`

Одноразовый 24-символьный код привязки хранится как `UserToken` c новым
`UserTokenType.TelegramLink`, а не отдельными полями `TelegramLinkCode`/`Expiry` на `User`.

Почему:
- `UserToken` — уже готовая машина одноразовых кодов (ADR 006): `RandomTokenGenerator`,
  `FindUsableTokenAsync` (проверка `UsedAtUtc`/`ExpiresAtUtc`), unique-индекс `(UserId, Type)`
  = ровно «один активный код привязки на пользователя», гашение через `UsedAtUtc`.
- Webhook ищет пользователя ПО коду — это буквально `FindUsableTokenAsync(code,
  TelegramLink)`, тот же lookup, что у verify-email/reset.
- Итог: на `User` добавляются ТОЛЬКО долгоживущие `TelegramChatId` + `TelegramUsername`,
  транзиентный код в сущность пользователя не протекает.

Deep-link-код (24 символа) генерируется новым методом `RandomTokenGenerator` из 18 случайных
байт в base64url — алфавит `[A-Za-z0-9_-]` совместим с ограничениями `?start=<payload>`
Telegram (только `[A-Za-z0-9_-]`, ≤64 символов).

### 5. Chat id — колонки на `User`; область доставки — `User` и `OrderLinked=Employee`

`TelegramChatId (bigint?)` и `TelegramUsername (nvarchar(32)?)` — колонки на `User` (1:1,
низкая кардинальность, как `PhoneNumber`/`PreferredLanguage`), с filtered-unique-индексом на
`TelegramChatId` (один чат ↔ один пользователь).

`ResolvedRecipient` получает `long? TelegramChatId`. Резолвер на платформе Telegram
заполняет chat id для источников:
- `User` — из `row.User.TelegramChatId` (основной, самодостаточный сценарий: staff привязал
  свой Telegram, админ выбрал его получателем).
- `OrderLinked=Employee` — из `User` исполнителя; `OrderEmployeeRecipient` получает
  `long? TelegramChatId`, заполняемый во всех трёх местах его сборки.

Осознанно ВНЕ СКОУПА в этой задаче:
- `OrderLinked=Client` по Telegram. Chat id клиента не спроецирован в `OrderInfoModel`;
  протаскивать его через широко используемую проекцию заказа ради наименее вероятного
  near-term сценария (публичный клиент привязал Telegram) — непропорционально. Резолвер
  на этом источнике по Telegram пишет лог и пропускает. Валидация по-прежнему РАЗРЕШАЕТ
  сконфигурировать такого получателя (это про «что можно настроить», а не «что доставится») —
  доставка просто no-op с логом, в духе существующего «тихо не шлём».
- Привязка Telegram публичного клиента и личный кабинет с preferences — отдельная будущая
  задача.
- Отправка PDF-вложений (assignment/order документов) в Telegram (`sendDocument`): Telegram
  несёт только текст-heads-up, PDF остаётся email-only. Точка расширения — `SendDocumentAsync`.

### 6. Chat id (`long`) vs `ResolvedRecipient.Address` (`string`)

Не перегружаем строковый `Address` под chat id (потеря типа; `ExpandUser` читает именно
`User.Email`). Добавляем отдельное типизированное `long? TelegramChatId`. Email-путь
продолжает заполнять `Address`, Telegram-путь — `TelegramChatId`; резолвер уже принимает
`platform` и ветвится по нему.

## Последствия

- Новый вертикальный срез транспорта (`ITelegramSender` + 2 реализации) и сервис привязки
  (`ITelegramLinkService`) — оба через конструкторный DI, как auth/email-вертикаль (ADR 005).
- `NotificationSettingsInfo.ImplementedPlatforms` включает Telegram → admin-баннер «не
  реализовано» гаснет по данным API; удаление хардкод-копии на фронте — отдельный
  frontend-подтаск.
- Миграция добавляет 2 колонки на `User` + индекс; новых таблиц нет; сид каналов не нужен
  (Telegram-канал по умолчанию выключен, включается админом через существующий flow).
