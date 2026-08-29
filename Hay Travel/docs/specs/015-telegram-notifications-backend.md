# Spec 015 — Реальная отправка Telegram-уведомлений (backend)

Статус: Ready for backend-developer
Архитектурные обоснования («почему»): [ADR 031](../adr/031-telegram-notifications-transport-and-linking.md)
Ориентир (вертикальный срез для копирования паттернов): **email-вертикаль** —
`IEmailSender`/`BrevoEmailSender`/`DevEmailSender`, `EmailSettings`, DI-регистрация
`IEmailSender`, `OrderNotificationService.DispatchAsync`, `NotificationRecipientResolver`,
машина одноразовых кодов `UserToken`/`RandomTokenGenerator`/`AuthService.FindUsableTokenAsync`.

Задача: `HayTravelNotificationsBot` дублирует email-уведомления заказов в Telegram. Транспорт
входящих — webhook. Привязка `User ↔ chat id` через deep-link `?start=<код>`. Всё содержимое
решений — в ADR 031; здесь только пошаговый список файлов и контрактов. Открытых вопросов «на
усмотрение разработчика» нет.

---

## 0. Ключевые архитектурные факты (не отклоняться)

- Транспорт исходящих — **чистый `HttpClient` POST** к `https://api.telegram.org/bot<token>/sendMessage`,
  НЕ NuGet `Telegram.Bot`. Копировать один-в-один паттерн `BrevoEmailSender` (см. ADR 031 §1).
- Содержимое Telegram-сообщения — **plaintext, собранный бэкендом** из события + контекста,
  локализованный через `NotificationLabels`. НЕ рендер admin-HTML-шаблона. У Telegram шаблона
  в модели нет (ADR 031 §2).
- Доставка **синхронная**, тем же `await` в `DispatchAsync`, что и email (ADR 031 §3).
- Код привязки — **`UserToken` с новым `UserTokenType.TelegramLink`**, не колонки на `User`
  (ADR 031 §4).
- Chat id — колонки на `User`; доставка по Telegram поддержана для источников **`User`** и
  **`OrderLinked=Employee`**; `OrderLinked=Client` по Telegram — **вне скоупа** (лог + skip),
  PDF-вложения в Telegram — **вне скоупа** (ADR 031 §5).

---

## 1. ATTours.Common

### 1.1 `Enums/UserTokenType.cs` — ИЗМЕНИТЬ
Добавить значение:
```csharp
TelegramLink = 3
```
Комментарий: одноразовый код привязки Telegram-аккаунта; та же машина, что verify/reset
(ADR 006), TTL другой.

### 1.2 `Entities/User.cs` — ИЗМЕНИТЬ
Добавить два поля (рядом с `PreferredLanguage`):
```csharp
// Привязанный чат HayTravelNotificationsBot. null = не привязан. Заполняется webhook'ом
// при /start <код>. Один чат ↔ один пользователь (filtered-unique-индекс).
public long? TelegramChatId { get; set; }

// Только для отображения админам/в профиле, в логике доставки не участвует. null до привязки.
public string TelegramUsername { get; set; }
```
Код привязки на `User` НЕ добавлять — он живёт в `UserToken` (см. §1.1, §4).

### 1.3 `Infrastructure/EntityConfiguration/UserConfiguration.cs` — ИЗМЕНИТЬ
Добавить:
```csharp
builder.Property(x => x.TelegramUsername).HasMaxLength(32);

// Один Telegram-чат не может быть привязан к двум пользователям. Filtered — непривязанные
// (NULL) строки в индекс не входят (тот же приём, что у Email/Username, но по IS NOT NULL).
builder.HasIndex(x => x.TelegramChatId)
    .IsUnique()
    .HasFilter("[TelegramChatId] IS NOT NULL");
```
`TelegramChatId` — bigint по конвенции (long), отдельно `Property` можно не настраивать.

### 1.4 `Settings/TelegramSettings.cs` — СОЗДАТЬ
Полный аналог `EmailSettings` (`ApplicationSettingsBase<TelegramSettings>`), секция `"Telegram"`:
```csharp
public class TelegramSettings : ApplicationSettingsBase<TelegramSettings>
{
    private const string SectionName = "Telegram";
    private IConfigurationSection Section => Configuration.GetSection(SectionName);

    public string BotToken => Section[nameof(BotToken)];
    public string BotUsername => Section[nameof(BotUsername)] ?? "HayTravelNotificationsBot";
    // Значение заголовка X-Telegram-Bot-Api-Secret-Token, задаётся при setWebhook.
    public string WebhookSecret => Section[nameof(WebhookSecret)];
    public int LinkCodeLifetimeMinutes => int.TryParse(Section[nameof(LinkCodeLifetimeMinutes)], out var m) ? m : 30;

    // Бот считается настроенным только когда заданы И токен, И webhook-secret — иначе тихо
    // работал бы Dev-режим (лог вместо отправки), а webhook отвергал бы всё.
    public bool IsConfigured => !string.IsNullOrWhiteSpace(BotToken) && !string.IsNullOrWhiteSpace(WebhookSecret);

    // База deep-link, к которой сервис привязки клеит "?start=<код>".
    public string DeepLinkBase => $"https://t.me/{BotUsername}";
}
```

### 1.5 `DTO/Telegram/TelegramUpdateModel.cs` — СОЗДАТЬ
Минимальный срез входящего апдейта Telegram (snake_case → `[JsonPropertyName]`). Только то,
что нужно для `/start`:
```csharp
public class TelegramUpdateModel
{
    [JsonPropertyName("update_id")] public long UpdateId { get; set; }
    [JsonPropertyName("message")]   public TelegramMessageModel Message { get; set; }
}
public class TelegramMessageModel
{
    [JsonPropertyName("text")] public string Text { get; set; }
    [JsonPropertyName("chat")] public TelegramChatModel Chat { get; set; }
    [JsonPropertyName("from")] public TelegramUserModel From { get; set; }
}
public class TelegramChatModel { [JsonPropertyName("id")] public long Id { get; set; } }
public class TelegramUserModel { [JsonPropertyName("username")] public string Username { get; set; } }
```

### 1.6 `DTO/Account/TelegramLinkCodeModel.cs` и `TelegramLinkStatusModel.cs` — СОЗДАТЬ
Ответы profile-эндпоинтов (§5.2):
```csharp
public class TelegramLinkCodeModel
{
    public string DeepLinkUrl { get; set; }      // https://t.me/HayTravelNotificationsBot?start=<код>
    public string Code { get; set; }             // 24 символа
    public DateTime ExpiresAtUtc { get; set; }
}
public class TelegramLinkStatusModel
{
    public bool IsLinked { get; set; }
    public string TelegramUsername { get; set; } // null, если не привязан
}
```

### 1.7 `Enums/GlobalErrorCode` (или где живёт enum) — при необходимости
Если для «Telegram не настроен на сервере» нужен свой код ответа — добавить
`TelegramNotConfigured`. Если хватает существующего validation-кода — переиспользовать.
Решение: добавить `TelegramNotConfigured` и бросать его из `IssueLinkCodeAsync`, когда
`TelegramSettings.IsConfigured == false` (иначе пользователь получил бы код и мёртвую ссылку).

---

## 2. ATTours.Service — транспорт (папка `Telegram/`, аналог `Email/`)

### 2.1 `Telegram/ITelegramSender.cs` — СОЗДАТЬ
```csharp
namespace ATTours.BusinessServices.Telegram
{
    public interface ITelegramSender
    {
        // false у Dev-реализации (только логирует). Симметрия с IEmailSender.
        bool IsConfigured { get; }

        // Одно текстовое уведомление в конкретный чат. text уже отрендерен (parse_mode=HTML,
        // ограниченный whitelist тегов Telegram) — транспорт ничего не сочиняет.
        Task SendMessageAsync(long chatId, string text, CancellationToken cancellationToken = default);
    }
}
```
Вложений/мультиполучателей нет (ADR 031 §5).

### 2.2 `Telegram/TelegramApiSender.cs` — СОЗДАТЬ
Точная калька `BrevoEmailSender`:
- ctor `(TelegramSettings settings, ILogger<TelegramApiSender> logger, HttpClient httpClient)`.
- `IsConfigured => true`.
- `SendMessageAsync`: POST `https://api.telegram.org/bot{settings.BotToken}/sendMessage`,
  payload `{ chat_id, text, parse_mode = "HTML" }`, через `PostAsJsonAsync`.
- Приватный `PostAsync` со swallow-and-log (`HttpRequestException`/`TaskCanceledException` и
  не-2xx → `LogError`, наружу не бросать) — как `BrevoEmailSender.PostAsync`.

### 2.3 `Telegram/DevTelegramSender.cs` — СОЗДАТЬ
Калька `DevEmailSender`: `IsConfigured => false`; `SendMessageAsync` только логирует
`LogInformation("[DevTelegramSender] chat {ChatId}: {Text}", chatId, text)` и возвращает
`Task.CompletedTask`.

---

## 3. ATTours.Service — сборка текста уведомления

### 3.1 `Notifications/OrderNotificationService.Telegram.cs` — СОЗДАТЬ (новый partial того же класса)
`OrderNotificationService` уже `partial`. В новом файле:
- поля/ctor НЕ дублировать; добавить `ITelegramSender` в ОСНОВНОЙ ctor (§4.1).
- метод `private async Task DispatchTelegramAsync(EmailActionKey key, OrderNotificationContext context, CancellationToken ct)`:
  1. `var recipients = await resolver.ResolveAsync(key, NotificationPlatform.Telegram, context, ct);`
     (канал-гейт `IsChannelEnabledAsync` уже внутри резолвера).
  2. `if (recipients.Count == 0) return;`
  3. Для каждого `r in recipients`:
     - `if (r.TelegramChatId is null) { logger.LogInformation(...«получатель настроен на Telegram, но не привязал аккаунт»...); continue; }`
     - `var text = BuildTelegramText(key, context, r.Language, r.Employee);`
     - `await telegramSender.SendMessageAsync(r.TelegramChatId.Value, text, ct);`
- метод `private static string BuildTelegramText(EmailActionKey key, OrderNotificationContext context, LanguageCode language, OrderEmployeeRecipient? employee)`:
  - plaintext/минимальный HTML (`<b>`), локализованный через `NotificationLabels`.
  - Первая строка — жирный заголовок события (короткая локализованная фраза per `EmailActionKey`,
    завести в `NotificationLabels` или локальной таблице строк внутри файла).
  - Далее — ключевые факты заказа тем же набором, что строит email-текст: номер заказа,
    список позиций (тур/дата/гостей) — переиспользуй логику `NotificationLabels.FormatDate`
    и обход `order.Lines`, как в `BuildOrderLinesHtml`, но текстом (`\n`, без `<p>`).
  - Для `employee != null` (персональное) — только его строки (`employee.LineIds`) и его роль,
    аналогично `BuildAssignmentDetailsHtml`, plaintext.
  - НЕ читать `EmailTemplate` (у Telegram шаблона нет).

### 3.2 `Notifications/OrderNotificationService.cs` — ИЗМЕНИТЬ (`DispatchAsync`, строки ~73-99)
Рефакторинг: вынести текущее тело в `DispatchEmailAsync(...)`, а `DispatchAsync` сделать:
```csharp
private async Task DispatchAsync(EmailActionKey key, OrderNotificationContext context, CancellationToken ct)
{
    await DispatchEmailAsync(key, context, ct);   // текущая логика без изменений
    await DispatchTelegramAsync(key, context, ct); // §3.1
}
```
Порядок: email первым (основной канал), Telegram вторым. Оба `await` синхронно (ADR 031 §3).

---

## 4. ATTours.Service — резолв chat id + сервис привязки

### 4.1 `Notifications/NotificationRecipientResolver.cs` — ИЗМЕНИТЬ
- `ResolvedRecipient`: добавить `public long? TelegramChatId { get; init; }`.
- `Expand`/`ExpandUser`/`ExpandOrderLinked` должны знать платформу. Проброс: `ResolveAsync`
  уже принимает `platform` — передать его в `Expand(row, context, platform)` и ниже.
- `ExpandUser`: на `platform == Telegram` заполнять `TelegramChatId = row.User.TelegramChatId`
  (и оставлять `Address` пустым; `Name` можно заполнить ФИО для логов). На `Email` — как
  сейчас (`Address = row.User.Email`). Пользователь без `TelegramChatId` НЕ отфильтровывать
  здесь (chat id может быть null) — пустой chat id отсекает `DispatchTelegramAsync` с логом.
- `ExpandOrderLinked`:
  - `Employee`-ветка на `platform == Telegram`: заполнять `TelegramChatId = employee.TelegramChatId`
    (см. §4.3), `Address` пустой.
  - `Client`-ветка на `platform == Telegram`: **не поддержана** — `logger.LogInformation(...«Telegram для order-linked клиента пока не поддержан»...)` и вернуть пусто (ADR 031 §5).
  - На `Email` обе ветки — без изменений.
- `NotificationSettingsInfo.GetEntityQueryableRepository()` уже `Include(x => x.User)` — chat id
  подтянется вместе с User, доп. Include не нужен.
- `Deduplicate`: сейчас дедуплицирует по `Address` (string). Для Telegram-получателей `Address`
  пустой → все схлопнулись бы в один. Исправить: дедуплицировать по ключу, включающему chat id,
  например `recipient.Address` при непустом, иначе `"tg:" + TelegramChatId`. Персональные
  (`Employee != null`) в дедуп по-прежнему не входят.

### 4.2 `Notifications/OrderEmployeeRecipient.cs` — ИЗМЕНИТЬ
Добавить:
```csharp
public long? TelegramChatId { get; set; }
```

### 4.3 Заполнить `TelegramChatId` во ВСЕХ трёх местах сборки `OrderEmployeeRecipient`
(источник — `User` исполнителя, у него теперь есть `TelegramChatId`):
- `Notifications/OrderNotificationService.cs` ~L181 (`LoadCurrentEmployeesAsync`) →
  `TelegramChatId = group.First().Employee.TelegramChatId`.
- `Services/UpdateServices/OrderAssignEmployeeService.cs` ~L133 →
  `TelegramChatId = employee.TelegramChatId`.
- `Services/UpdateServices/OrderUnassignEmployeeService.cs` ~L80 →
  `TelegramChatId = <employee>.TelegramChatId` (взять из того же источника User в этой проекции).

### 4.4 `Telegram/ITelegramLinkService.cs` + `TelegramLinkService.cs` — СОЗДАТЬ (папка `Telegram/`)
Scoped-сервис (владеет DbContext, как `AuthService`). Переиспользует машину `UserToken`:
`IEntityRepository<UserToken>` + `RandomTokenGenerator` + проверку `UsedAtUtc`/`ExpiresAtUtc`
(калька `AuthService.FindUsableTokenAsync`, строки 848-858 — код взять оттуда, не изобретать).

Интерфейс:
```csharp
public interface ITelegramLinkService
{
    // Профиль: выдать (или перевыпустить) одноразовый код привязки текущего пользователя.
    // Бросает TelegramNotConfigured, если TelegramSettings.IsConfigured == false.
    Task<TelegramLinkCodeModel> IssueLinkCodeAsync(int userId, CancellationToken ct = default);

    // Профиль: статус привязки текущего пользователя.
    Task<TelegramLinkStatusModel> GetStatusAsync(int userId, CancellationToken ct = default);

    // Профиль: отвязать (сбросить TelegramChatId/TelegramUsername).
    Task UnlinkAsync(int userId, CancellationToken ct = default);

    // Webhook: обработать входящий апдейт. Внутри распознаёт "/start <код>", остальное
    // логирует и игнорирует. Возвращает текст-ответ для отправки пользователю в Telegram
    // (или null, если отвечать нечего).
    Task<TelegramUpdateResult> HandleUpdateAsync(TelegramUpdateModel update, CancellationToken ct = default);
}

// chatId нужен контроллеру, чтобы отправить ReplyText обратно через ITelegramSender.
public sealed class TelegramUpdateResult
{
    public long? ChatId { get; init; }
    public string ReplyText { get; init; }
}
```

Реализация:
- `IssueLinkCodeAsync`: проверить `IsConfigured`; сгенерировать 24-символьный код (§6.1);
  upsert `UserToken(Type=TelegramLink, Token=код, ExpiresAtUtc=now+LinkCodeLifetimeMinutes,
  UsedAtUtc=null)` по `(UserId, Type)` (перезапись активного — как verify/reset); вернуть
  `TelegramLinkCodeModel { DeepLinkUrl = $"{settings.DeepLinkBase}?start={код}", Code, ExpiresAtUtc }`.
- `GetStatusAsync`: прочитать User → `{ IsLinked = TelegramChatId != null, TelegramUsername }`.
- `UnlinkAsync`: обнулить `TelegramChatId`/`TelegramUsername`, save.
- `HandleUpdateAsync`:
  - `text = update?.Message?.Text?.Trim()`; если не начинается с `"/start "` → лог Debug,
    вернуть `new TelegramUpdateResult()` (ChatId=null → контроллер ничего не отвечает).
  - извлечь код после `"/start "`.
  - `FindUsableTokenAsync(code, TelegramLink)` (калька из AuthService): если null →
    `ReplyText = «Код недействителен или истёк»`, `ChatId = update.Message.Chat.Id`.
  - иначе: `token.User.TelegramChatId = update.Message.Chat.Id`,
    `token.User.TelegramUsername = update.Message.From?.Username`, `token.UsedAtUtc = now`,
    save; `ReplyText = «Аккаунт привязан…»`, `ChatId = chat.Id`.
  - Тексты ответов — двуязычность не требуется (пользователь ещё не идентифицирован до привязки);
    RU по умолчанию (решение архитектора, консистентно с системными сообщениями).

---

## 5. ATTours.ClientAPI

### 5.1 `Controllers/TelegramWebhookController.cs` — СОЗДАТЬ
```csharp
[ApiController]
[Route("api/telegram")]
[AllowAnonymous]
public class TelegramWebhookController(ITelegramLinkService linkService, ITelegramSender sender,
    TelegramSettings settings) : Controller
```
- `POST api/telegram/webhook`, `[FromBody] TelegramUpdateModel update`:
  1. Проверить секрет: заголовок `X-Telegram-Bot-Api-Secret-Token` == `settings.WebhookSecret`.
     Несовпадение/пусто → `return NotFound()` (не раскрываем эндпоинт). Читать заголовок из
     `Request.Headers["X-Telegram-Bot-Api-Secret-Token"]`.
  2. `var result = await linkService.HandleUpdateAsync(update, ct);`
  3. `if (result.ChatId is not null && !string.IsNullOrEmpty(result.ReplyText))
        await sender.SendMessageAsync(result.ChatId.Value, result.ReplyText, ct);`
  4. `return Ok();` ВСЕГДА (кроме проваленного секрета) — иначе Telegram ретраит апдейт.
- Никакого меню/иной логики: прочие апдейты сервис уже проглотил.

### 5.2 `Controllers/AccountController.cs` — ИЗМЕНИТЬ (добавить эндпоинты, `[Authorize]`, id из токена)
Внедрить `ITelegramLinkService` в ctor (сейчас `AccountController(IMapper mapper)` → добавить
параметр). Эндпоинты (id всегда `User.GetUserId()`, никогда из тела — как остальной
AccountController):
- `GET  api/Account/Telegram`         → `GetStatusAsync` → `TelegramLinkStatusModel`.
- `POST api/Account/Telegram/LinkCode`→ `IssueLinkCodeAsync` → `TelegramLinkCodeModel`.
- `DELETE api/Account/Telegram`       → `UnlinkAsync` → 204/`NoContent` или `TelegramLinkStatusModel`.

### 5.3 `DependencyInjection/DependencyInjectionConfiguration.cs` — ИЗМЕНИТЬ
В `AddServices` (по образцу блока `IEmailSender`, строки 36-57, и `IOrderNotificationService`,
строка 79):
```csharp
services.AddSingleton(TelegramSettings.Instance);
services.AddHttpClient(nameof(TelegramApiSender));
services.AddSingleton<ITelegramSender>(sp =>
{
    var s = sp.GetRequiredService<TelegramSettings>();
    if (s.IsConfigured)
        return new TelegramApiSender(s,
            sp.GetRequiredService<ILogger<TelegramApiSender>>(),
            sp.GetRequiredService<IHttpClientFactory>().CreateClient(nameof(TelegramApiSender)));
    return new DevTelegramSender(sp.GetRequiredService<ILogger<DevTelegramSender>>());
});
services.AddScoped<ITelegramLinkService, TelegramLinkService>();
```
`OrderNotificationService` уже Scoped — ему добавится зависимость `ITelegramSender` (singleton),
регистрация строки 79 не меняется.

---

## 6. Переиспользование существующего кода (НЕ писать заново)

### 6.1 Генерация 24-символьного кода — `RandomTokenGenerator`
Файл `ATTours.Service/Security/RandomTokenGenerator.cs`. Добавить метод:
```csharp
// Deep-link-код Telegram (?start=<payload>): алфавит base64url [A-Za-z0-9_-] совместим с
// ограничениями Telegram. 18 байт -> 24 символа base64url без паддинга.
public static string CreateDeepLinkCode() => Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(18));
```
(`Base64UrlEncoder` уже импортирован в файле; `Create()` использует его же.)

### 6.2 Поиск/гашение одноразового токена — калька `AuthService.FindUsableTokenAsync`
`ATTours.Service/Services/AuthServices/AuthService.cs:848-858`. В `TelegramLinkService`
воспроизвести тот же lookup (`.Include(x => x.User)`, отсев `UsedAtUtc`/`ExpiresAtUtc <= now`)
для `UserTokenType.TelegramLink`.

### 6.3 Upsert активного токена по `(UserId, Type)`
`AuthService.UpsertUserTokenAsync` (используется в `ResendEmailVerificationAsync`, ~L876) —
тот же приём «перезаписать активную строку» для `IssueLinkCodeAsync`.

---

## 7. Миграция (ATTours.DataLayer/Migrations)

Имя: `AddTelegramNotificationSupport`. Содержит ТОЛЬКО:
- `User.TelegramChatId` (bigint, nullable).
- `User.TelegramUsername` (nvarchar(32), nullable).
- Filtered-unique-индекс на `TelegramChatId` (`WHERE [TelegramChatId] IS NOT NULL`).

НЕ входит и не нужно:
- Новых таблиц нет.
- `UserTokenType.TelegramLink` — int-значение enum, схему не меняет.
- Сид `NotificationChannel` для Telegram НЕ нужен: отсутствие строки канала = выключено
  (`IsChannelEnabledAsync`), Telegram по умолчанию не шлётся, пока админ не включит канал
  через существующий flow настроек уведомлений.

Миграции применяются на старте API (backend_ef_auto_migrations) — доп. действий по накату нет.

---

## 8. Снятие пометки «не реализовано»

### 8.1 `ATTours.Service/Services/InfoServices/NotificationSettingsInfo.cs:21-22` — ИЗМЕНИТЬ
`ImplementedPlatforms` → `[NotificationPlatform.Email, NotificationPlatform.Telegram]`. После
этого `GetEventsAsync` вернёт `IsImplemented = true` для Telegram, и admin-грид перестанет
блокировать вкладку.

### 8.2 Frontend-подтаск (ВНЕ backend-скоупа, но зафиксировать)
- `Hay Travel/Frontend/src/features/admin/notifications/lib/notificationsCopy.ts:55-56` —
  убрать баннер «не реализовано» для Telegram (после §8.1 API уже отдаёт `IsImplemented=true`;
  проверить, читает ли фронт этот флаг или хардкодит копию — привести в соответствие).
- Профиль пользователя: кнопка «Привязать Telegram» → `POST api/Account/Telegram/LinkCode` →
  показать `DeepLinkUrl` (ссылкой/QR), статус через `GET api/Account/Telegram`, «Отвязать» →
  `DELETE api/Account/Telegram`.
- Разовая регистрация webhook на VPS: `setWebhook` с `url=https://<host>/api/telegram/webhook`
  и `secret_token=<WebhookSecret>` (ops-действие, не код).

---

## 9. Конфигурация (appsettings)

`ATTours.ClientAPI/appsettings.json` — добавить секцию (пустые секреты, реальные значения —
через env var, как `Email:BrevoApiKey`):
```json
"Telegram": {
  "BotToken": "",
  "BotUsername": "HayTravelNotificationsBot",
  "WebhookSecret": "",
  "LinkCodeLifetimeMinutes": 30
}
```

---

## 10. Явно ВНЕ скоупа этой задачи

- Telegram-доставка для `OrderLinked=Client` (chat id клиента не проецируется в `OrderInfoModel`).
- PDF/файловые вложения в Telegram (`sendDocument`).
- Админ-редактируемые Telegram-шаблоны / HTML→text-конвертация email-тела.
- Личный кабинет с preferences (тема/язык/валюта, подписки email vs telegram) — отдельная задача.
- Long-polling, меню/inline-клавиатуры, любой интерактив бота сверх `/start <код>`.
- Вынос доставки в фоновый outbox (при появлении проблем с латентностью — отдельным решением
  для ОБОИХ каналов сразу, ADR 031 §3).
