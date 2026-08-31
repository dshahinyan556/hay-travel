# Spec 016 — Контакты для связи с клиентом (backend)

Статус: Ready for backend-developer
Архитектурные обоснования («почему»): [ADR 032](../adr/032-order-contact-as-value-snapshot.md)
Чек-лист задачи: `docs/checklists/checklist-contacts-and-transfer-wizard-2026-08-29.txt`, Фазы 1-2
Ветка: `claude/transfers-product-format-2026-08-29`

Ориентиры (вертикальные срезы для копирования паттернов — брать именно их, а не «похожее»):
- **`CustomTransferDetails` / `CustomTransferStop`** — дочерняя сущность заказа: Entity +
  `[EntityTypeConfiguration]` + конфигурация + `DbSet` + Include в `OrderInfo` + Info-модель +
  маппинг + сборка сервером в `CustomTransferRequestCreationService`.
- **`UserPhoneUpdateService` + `AccountController.UpdatePhoneAsync`** — self-service операция
  личного кабинета: id только из токена, точечный сервис на `RepositoryCoreBase`.
- **`ExpenseTemplate`-вертикаль** — Create/Update/Delete/Info сервисы и форма CRUD-контроллера.
- **`EmailPlaceholders.OrderLines` + `OrderNotificationService.BuildOrderLinesHtml`** —
  добавление нового HTML-токена письма и его отражение в Telegram-ветке.

Задача: у каждого заказа есть явный контакт для связи (Имя + Фамилия + способ + значение),
1..3 штуки, ровно один основной. Контакты копятся в профиле пользователя как справочник и
переиспользуются. В заказе контакт — **снимок** значений. Контакт виден в админской карточке
заказа и уезжает в письмо новым токеном `{{ClientContact}}`.

Открытых вопросов «на усмотрение разработчика» в этой спецификации нет.

---

## 0. Ключевые архитектурные факты (не отклоняться)

1. `OrderContact` — **копия значений**, FK на `UserContactMethod` НЕТ (ADR 032 Р1). Правка и
   удаление контакта в профиле не касаются уже созданных заказов.
2. `UserContactMethod` удаляется **физически** (`DELETE`), soft-delete не вводится (следствие 1).
3. Правило «1..3 контакта, ровно один основной» живёт **в `OrderValidationService`** рядом с
   `ValidateLineCount` — правило агрегата, а не сервиса создания (ADR 032 Р2). Обе существующие
   точки создания заказа уже прогоняют эту валидацию и получат правило автоматически.
4. Отказ по контактам — **плоский `ErrorModelException`**, не пер-строчный `OrderLinesErrorModel`,
   даже в режиме `PerLine`: контакт принадлежит шапке заказа, как `OrderMustHaveAtLeastOneLine`.
5. Мультиязычности у контактов нет: `ITranslatableModel`/`TranslatableInfoModel` **не применять**.
6. Формат хранения телефона у контакта — **с ведущим `+`** (`+` и 8..15 цифр). Это НЕ формат
   `User.PhoneNumber` (там хранится без `+`) и приводить их друг к другу не нужно (ADR 032).
7. Экрана ручного создания заказа админом в коде НЕТ. Отдельный эндпоинт под него в этой
   задаче **не заводится** — требование «контакт обязателен и у админа» выполняется тем, что
   правило лежит в валидации агрегата (п. 3).
8. Существующие заказы **не бэкфиллятся**: у них 0 контактов, админка показывает пустой блок.
   Придумывать им контакт из `User.PhoneNumber` нельзя — это выдуманные данные.

---

## 1. ATTours.Common

### 1.1 `Enums/ContactMethodType.cs` — СОЗДАТЬ
```csharp
namespace ATTours.Common.Enums
{
    // Способ связи с клиентом (батч «Контакты в заказах», 2026-08-29). Набор закрытый —
    // enum, а не строковый ключ (то же правило, что у EmailActionKey).
    //
    // Значения нумеруются с 1: 0 в enum'ах этого проекта не используется, иначе «поле не
    // заполнено» и «Телефон» стали бы неотличимы в JSON.
    public enum ContactMethodType
    {
        // Голосовой звонок на номер. Отличается от WhatsApp/Viber только тем, КАК связаться:
        // значение у всех трёх — международный номер.
        Phone = 1,
        WhatsApp = 2,
        Telegram = 3,
        Viber = 4,
        Email = 5
    }
}
```

### 1.2 `Entities/UserContactMethod.cs` — СОЗДАТЬ
```csharp
using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Справочник способов связи в профиле пользователя (батч 2026-08-29): клиент один раз
    // заводит «муж, WhatsApp, +374...» и переиспользует его в следующих заказах.
    //
    // К контактам УЖЕ СОЗДАННЫХ заказов отношения не имеет: там лежит снимок значений
    // (OrderContact), FK между таблицами нет — ADR 032 Р1. Поэтому строка удаляется
    // физически, soft-delete здесь не нужен.
    //
    // Обратной коллекции на User нет: справочник всегда читается своим запросом по UserId,
    // графом пользователя — никогда (то же правило, что у Order.UserId).
    [EntityTypeConfiguration(typeof(UserContactMethodConfiguration))]
    public class UserContactMethod : EntityBase
    {
        // Всегда из токена (User.GetUserId()), никогда из тела запроса — иначе эндпоинт
        // позволял бы завести контакт в чужом профиле.
        public int UserId { get; set; }
        public User User { get; set; }

        public ContactMethodType Type { get; set; }

        // Нормализованное значение: номер с ведущим «+», e-mail в нижнем регистре,
        // Telegram — «@username» либо номер. Нормализует ContactMethodValidator.
        public string Value { get; set; }

        // Кому звонить, а не кто владелец аккаунта: жена оформляет заказ, связаться надо
        // с мужем. Оба обязательны.
        public string FirstName { get; set; }
        public string LastName { get; set; }

        // Контакт по умолчанию в справочнике — им форма заказа предзаполняется первым.
        // Инвариант «не больше одного на пользователя» держит сервис, а не уникальный
        // индекс (ADR 032 Р4).
        public bool IsPrimary { get; set; }
    }
}
```

### 1.3 `Entities/OrderContact.cs` — СОЗДАТЬ
```csharp
using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Контакт для связи по КОНКРЕТНОМУ заказу — СНИМОК значений на момент создания
    // (ADR 032 Р1). Правка или удаление контакта в справочнике профиля
    // (UserContactMethod) не должны менять уже оформленный заказ, поэтому FK на справочник
    // здесь СОЗНАТЕЛЬНО отсутствует: тот же принцип, что у OrderLine.PriceSnapshot и
    // VehicleClassNameSnapshot.
    //
    // 1..3 строки на заказ, ровно одна с IsPrimary — правило проверяет
    // OrderValidationService (правило агрегата, а не сервиса создания).
    [EntityTypeConfiguration(typeof(OrderContactConfiguration))]
    public class OrderContact : EntityBase
    {
        public int OrderId { get; set; }
        public Order Order { get; set; }

        public ContactMethodType Type { get; set; }

        // Уже нормализованное значение (ContactMethodValidator) — в БД не попадает то,
        // что прислал клиент «как есть».
        public string Value { get; set; }

        public string FirstName { get; set; }
        public string LastName { get; set; }

        // Тот, кому менеджер звонит первым. Ровно один на заказ.
        public bool IsPrimary { get; set; }

        // Порядок показа в карточке заказа, письме и Telegram. Ставит СЕРВЕР (основной = 0,
        // остальные в порядке, в котором пришли), клиентскому значению не доверяем — тот же
        // приём, что у CustomTransferStop.SortOrder.
        public int SortOrder { get; set; }
    }
}
```

### 1.4 `Entities/Order.cs` — ИЗМЕНИТЬ
Добавить коллекцию рядом с `Lines`:
```csharp
        // Контакты для связи по этому заказу — 1..3, ровно один основной (батч 2026-08-29).
        // Снимок значений на момент создания, справочник профиля им не владеет (ADR 032).
        public HashSet<OrderContact> Contacts { get; set; } = [];
```
Больше в `Order.cs` ничего не меняется. `User.cs` **не трогать вовсе**.

### 1.5 `Infrastructure/EntityConfiguration/UserContactMethodConfiguration.cs` — СОЗДАТЬ
```csharp
using ATTours.Common.Constants;
using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class UserContactMethodConfiguration : IEntityTypeConfiguration<UserContactMethod>
    {
        public void Configure(EntityTypeBuilder<UserContactMethod> builder)
        {
            builder.ToTable(nameof(UserContactMethod));

            // Cascade, в отличие от Order -> User: справочник это личные данные владельца,
            // без него он бессмыслен, а «осиротить» им нечего — заказы держат СНИМОК и от
            // этой таблицы не зависят (ADR 032 Р1). WithMany() без навигации: коллекции
            // ContactMethods на User нет.
            builder.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Property(x => x.Value)
                .IsRequired()
                .HasMaxLength(ContactLimits.MaxValueLength);

            builder.Property(x => x.FirstName)
                .IsRequired()
                .HasMaxLength(ContactLimits.MaxNameLength);

            builder.Property(x => x.LastName)
                .IsRequired()
                .HasMaxLength(ContactLimits.MaxNameLength);

            // Единственный сценарий чтения — «весь справочник одного пользователя».
            builder.HasIndex(x => x.UserId);

            // Уникального filtered-индекса по (UserId) WHERE IsPrimary = 1 здесь НЕТ
            // сознательно: смена основного — снятие флага у старого и установка у нового в
            // одном SaveChanges, порядок UPDATE-ов EF не гарантирует (ADR 032 Р4).
        }
    }
}
```

### 1.6 `Infrastructure/EntityConfiguration/OrderContactConfiguration.cs` — СОЗДАТЬ
```csharp
using ATTours.Common.Constants;
using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class OrderContactConfiguration : IEntityTypeConfiguration<OrderContact>
    {
        public void Configure(EntityTypeBuilder<OrderContact> builder)
        {
            builder.ToTable(nameof(OrderContact));

            // Cascade — та же семантика, что у OrderLine -> Order: контакт без заказа
            // бессмыслен, а заказ удаляется целиком (OrderDeletionService).
            builder.HasOne(x => x.Order)
                .WithMany(x => x.Contacts)
                .HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Property(x => x.Value)
                .IsRequired()
                .HasMaxLength(ContactLimits.MaxValueLength);

            builder.Property(x => x.FirstName)
                .IsRequired()
                .HasMaxLength(ContactLimits.MaxNameLength);

            builder.Property(x => x.LastName)
                .IsRequired()
                .HasMaxLength(ContactLimits.MaxNameLength);

            builder.HasIndex(x => x.OrderId);
        }
    }
}
```

### 1.7 `Constants/ContactLimits.cs` — СОЗДАТЬ
```csharp
namespace ATTours.Common.Constants
{
    // Доменные лимиты контактов (батч 2026-08-29). Вынесены в константы по той же причине,
    // что и OrderLimits: те же числа держит у себя фронт, магические литералы в двух местах
    // гарантированно разъедутся. TS и C# в этом репозитории код не делят.
    public static class ContactLimits
    {
        // Контактов в ОДНОМ заказе. Минимум — 1 (заказ без контакта не принимается),
        // максимум — 3 (решение заказчика).
        public const int MinOrderContacts = 1;
        public const int MaxOrderContacts = 3;

        // Потолок справочника в профиле. Прямого требования заказчика нет — стоит как
        // защита от прямого запроса к API, который наплодит тысячи строк на пользователя.
        public const int MaxProfileContacts = 20;

        // Ширина колонки Value: 254 — максимальная длина адреса e-mail (RFC 5321),
        // остальные способы связи заведомо короче.
        public const int MaxValueLength = 254;

        // Имя/фамилия контакта. 128 — как у User.FirstName/LastName (UserConfiguration).
        public const int MaxNameLength = 128;
    }
}
```

### 1.8 `Extensions/ContactMethodTypeExtensions.cs` — СОЗДАТЬ
Полный аналог `EmployeeJobRoleExtensions` — подписи нужны бэкенду только для письма и
Telegram; в API подписи не уходят, фронт мапит числа сам.
```csharp
public static string ToLabel(this ContactMethodType type, LanguageCode language)
```
RU: `Phone → "Телефон"`, `WhatsApp → "WhatsApp"`, `Telegram → "Telegram"`,
`Viber → "Viber"`, `Email → "E-mail"`.
EN: `Phone → "Phone"`, остальные — те же строки, `Email → "Email"`.
Значение вне enum — `string.Empty` (то же правило, что у ролей).

### 1.9 `DTO/Init/OrderContactCreateModel.cs` — СОЗДАТЬ
```csharp
using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Init
{
    // Один контакт для связи в теле создания заказа (батч 2026-08-29). Одинаково приезжает
    // и из чекаута корзины, и из кастомной заявки на трансфер.
    //
    // Ссылки на контакт справочника (UserContactMethodId) здесь НЕТ и быть не должно:
    // в заказ уезжает снимок значений (ADR 032 Р1). Фронт, выбравший сохранённый контакт,
    // просто присылает его поля.
    public class OrderContactCreateModel
    {
        public ContactMethodType Type { get; set; }
        public string Value { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }

        // Ровно у одного контакта заказа должен стоять true. Сервер это ПРОВЕРЯЕТ, а не
        // досчитывает: кому звонить первым — решение клиента, не порядок полей формы.
        public bool IsPrimary { get; set; }
    }
}
```

### 1.10 `DTO/Init/OrderCreateModel.cs` — ИЗМЕНИТЬ
Добавить свойство + комментарий:
```csharp
        // Контакты для связи: 1..3, ровно один основной. Пустой список — отказ
        // (OrderContactRequired): менеджер не должен гадать, по какому номеру звонить.
        public List<OrderContactCreateModel> Contacts { get; set; } = [];
```

### 1.11 `DTO/Init/CustomTransferRequestCreateModel.cs` — ИЗМЕНИТЬ
Добавить то же свойство с тем же комментарием — контракт контактов у заявки идентичен
контракту чекаута.

### 1.12 `DTO/Info/OrderContactInfoModel.cs` — СОЗДАТЬ
```csharp
using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Info
{
    // Контакт для связи в карточке заказа (админка), «моих заказах» и письме.
    // Порядок списка задаёт сервер: основной первым (см. маппинг Order -> OrderInfoModel).
    public class OrderContactInfoModel
    {
        public int Id { get; set; }
        public ContactMethodType Type { get; set; }
        public string Value { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public bool IsPrimary { get; set; }
        public int SortOrder { get; set; }
    }
}
```

### 1.13 `DTO/Info/OrderInfoModel.cs` — ИЗМЕНИТЬ
Добавить рядом с `Lines`:
```csharp
        // Контакты для связи, ОСНОВНОЙ ПЕРВЫМ (порядок задаёт маппинг, фронт не сортирует).
        // Пустой список у заказов, созданных до батча 2026-08-29 — их не бэкфиллили.
        public List<OrderContactInfoModel> Contacts { get; set; } = [];
```

### 1.14 `DTO/Account/ContactMethodInfoModel.cs` — СОЗДАТЬ
```csharp
using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Account
{
    // Строка справочника способов связи в личном кабинете.
    public class ContactMethodInfoModel
    {
        public int Id { get; set; }
        public ContactMethodType Type { get; set; }
        public string Value { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public bool IsPrimary { get; set; }
    }
}
```

### 1.15 `DTO/Account/ContactMethodCreateModel.cs` — СОЗДАТЬ
`Type`, `Value`, `FirstName`, `LastName`, `IsPrimary`. `UserId` в модели НЕТ — он всегда из
токена.

### 1.16 `DTO/Account/ContactMethodUpdateModel.cs` — СОЗДАТЬ
То же + `public int Id { get; set; }`.

> Почему `DTO/Account`, а не `DTO/Init` + `DTO/Request`: справочник — вертикаль личного
> кабинета, и там уже лежат `UpdatePhoneModel` и Info-образный `TelegramLinkStatusModel`.
> Модели ЗАКАЗА (`OrderContactCreateModel`/`OrderContactInfoModel`) остаются в `Init`/`Info`
> вместе с остальным заказом.

---

## 2. ATTours.Helper

### 2.1 `Enums/GlobalErrorCode.cs` — ИЗМЕНИТЬ
Занятый максимум в блоке `EntityErrors` — `2059` (`RequiredFieldMissing`). Добавить ПОСЛЕ него,
до `#endregion`:
```csharp
        // Контакты для связи с клиентом (батч 2026-08-29), 2060-2065. Первые три —
        // правила АГРЕГАТА заказа, приходят плоско (не в массиве lines), как
        // OrderMustHaveAtLeastOneLine/OrderTooManyLines.
        [Description("Order must have at least one client contact.")]
        OrderContactRequired = 2060,
        [Description("Order cannot have more than 3 client contacts.")]
        OrderTooManyContacts = 2061,
        // Ни одного основного либо больше одного. Сервер это проверяет, а не досчитывает:
        // кому звонить первым — решение клиента (ADR 032 Р3).
        [Description("Exactly one client contact must be marked as primary.")]
        OrderPrimaryContactInvalid = 2062,
        // Значение не соответствует выбранному способу связи: телефон/WhatsApp/Viber —
        // «+» и 8..15 цифр, Email — адрес, Telegram — @username либо номер.
        // Один код на все способы: сообщение называет конкретный способ, а разбирать их по
        // отдельным кодам фронту незачем — он валидирует то же самое сам.
        [Description("Contact value does not match the selected contact method.")]
        InvalidContactValue = 2063,
        [Description("Contact method not found.")]
        ContactMethodNotFound = 2064,
        [Description("Contact method limit reached for this profile.")]
        TooManyContactMethods = 2065,
```
Пустое имя/фамилия контакта НОВОГО кода не получает — используется существующий
`RequiredFieldMissing` (2059), его описание ровно про это, а сообщение называет поле.

---

## 3. ATTours.Service (`ATTours.BusinessServices`)

### 3.1 `Services/Shared/ContactMethodValidator.cs` — СОЗДАТЬ
Единственное место на бэке, где живёт правило «как выглядит корректный контакт». Им
пользуются и справочник профиля, и валидация заказа — иначе две копии регулярок разъедутся
(та же мотивация, что у `OrderLinePricing`). Зеркалит фронтовую валидацию; фронтовая — это
UX, эта — защита.

```csharp
namespace ATTours.BusinessServices.Services.Shared
{
    public static partial class ContactMethodValidator
    {
        // Приводит значение к каноническому виду ДО валидации и ДО записи в БД.
        // Телефонные способы: убираются пробелы, скобки, дефисы и точки.
        // Email: Trim + ToLowerInvariant.
        // Telegram: Trim, регистр сохраняется как есть.
        // null/пусто -> string.Empty (валидация отобьёт).
        public static string Normalize(ContactMethodType type, string value);

        // true, если НОРМАЛИЗОВАННОЕ значение соответствует способу связи.
        public static bool IsValid(ContactMethodType type, string value);
    }
}
```
Правила по способам:

| Способ | Правило значения |
| --- | --- |
| `Phone`, `WhatsApp`, `Viber` | `^\+\d{8,15}$` |
| `Email` | `^[^@\s]+@[^@\s]+\.[^@\s]+$` |
| `Telegram` | `^@[A-Za-z][A-Za-z0-9_]{4,31}$` ИЛИ `^\+\d{8,15}$` |

Ведущий `+` **обязателен и сервером не дописывается**: `89261234567` без плюса — это
российский междугородний формат, а не `+8...`, и угадывать страну за клиента нельзя. Формат
отличается от `User.PhoneNumber` (там без `+`) сознательно — см. ADR 032, раздел «Что это
решение НЕ утверждает».

Регексы — `[GeneratedRegex]`-партиалы (как `PlaceholderRegex` в `OrderNotificationService`),
поэтому класс `partial`.

### 3.2 `Services/Shared/OrderContactBuilder.cs` — СОЗДАТЬ
```csharp
namespace ATTours.BusinessServices.Services.Shared
{
    // Сборка контактов заказа из тела запроса — общая для чекаута корзины и кастомной
    // заявки. Отдельный хелпер, а не метод одного из сервисов создания: правило одно, а
    // точек создания заказа уже две и будет третья (ручное создание админом).
    public static class OrderContactBuilder
    {
        // Нормализует значения, тримит имена, назначает SortOrder: основной = 0, остальные
        // в порядке, в котором пришли. Порядку из тела запроса не доверяем — от него
        // зависит, кому менеджер позвонит первым.
        //
        // НИЧЕГО не отбивает: все отказы принимает OrderValidationService, чтобы у правила
        // был один владелец. null -> пустой список.
        public static List<OrderContact> Build(IEnumerable<OrderContactCreateModel> requested);
    }
}
```
Дубли по паре (`Type`, `Value`) внутри одного заказа сознательно НЕ отбиваются и НЕ
схлопываются: при потолке в 3 контакта это безвредно, а молча менять присланное сервер не
должен.

### 3.3 `Services/ValidationServices/OrderValidationService.cs` — ИЗМЕНИТЬ
1. В `ValidateEntitiesAsync`, в цикле `foreach (var order in Entities)`, **сразу после**
   `ValidateLineCount(order);` добавить `ValidateContacts(order);`.
2. Добавить приватный статический метод рядом с `ValidateLineCount`:
```csharp
        // Контакты — правило ШАПКИ заказа, поэтому бросается плоско даже в режиме PerLine:
        // привязать «нет контакта» к позиции корзины нельзя, её вины тут нет.
        private static void ValidateContacts(Order order)
        {
            if (order.Contacts.Count < ContactLimits.MinOrderContacts)
                throw new ErrorModelException(GlobalErrorCode.OrderContactRequired, HttpStatusCode.BadRequest,
                    "Order must have at least one client contact.");

            if (order.Contacts.Count > ContactLimits.MaxOrderContacts)
                throw new ErrorModelException(GlobalErrorCode.OrderTooManyContacts, HttpStatusCode.BadRequest,
                    $"Order cannot have more than {ContactLimits.MaxOrderContacts} client contacts, got {order.Contacts.Count}.");

            if (order.Contacts.Count(contact => contact.IsPrimary) != 1)
                throw new ErrorModelException(GlobalErrorCode.OrderPrimaryContactInvalid, HttpStatusCode.BadRequest,
                    "Exactly one client contact must be marked as primary.");

            foreach (var contact in order.Contacts)
            {
                if (string.IsNullOrWhiteSpace(contact.FirstName) || string.IsNullOrWhiteSpace(contact.LastName))
                    throw new ErrorModelException(GlobalErrorCode.RequiredFieldMissing, HttpStatusCode.BadRequest,
                        "Client contact requires both first name and last name.");

                if (!ContactMethodValidator.IsValid(contact.Type, contact.Value))
                    throw new ErrorModelException(GlobalErrorCode.InvalidContactValue, HttpStatusCode.BadRequest,
                        $"Contact value is not valid for method {contact.Type}.");
            }
        }
```
3. Обновить шапочный комментарий класса: добавить строку про группу правил «контакты для
   связи (батч 2026-08-29)».

### 3.4 `Services/CreateServices/OrderCreationService.cs` — ИЗМЕНИТЬ
1. Конструкторы принимают модель целиком:
```csharp
public OrderCreationService(OrderCreateModel model, int userId, CancellationToken cancellationToken = default)
public OrderCreationService(OrderCreateModel model, int userId, IApplicationDbContext context, CancellationToken cancellationToken = default)
```
   Передаётся `OrderCreateModel`, а не третий позиционный список: у сервиса уже два
   конструктора, и ещё один список `List<...>` рядом с `List<...>` — приглашение перепутать
   их местами. Внутри: `this.lines = model?.Lines ?? []; this.contacts = model?.Contacts ?? [];`
2. В `EnrichAsync`, **после** заполнения `order.Lines`, до расчёта `order.Status`:
```csharp
            // Контакты — снимок значений (ADR 032). Отказ при 0/>3/не-одном основном
            // принимает OrderValidationService, здесь только сборка.
            foreach (var contact in OrderContactBuilder.Build(contacts))
                order.Contacts.Add(contact);
```

### 3.5 `Services/CreateServices/CustomTransferRequestCreationService.cs` — ИЗМЕНИТЬ
В `EnrichAsync`, после `order.Lines.Add(BuildLine());`, тот же блок:
```csharp
            foreach (var contact in OrderContactBuilder.Build(request.Contacts))
                order.Contacts.Add(contact);
```
Конструкторы не меняются — контакты приезжают внутри `CustomTransferRequestCreateModel`.

### 3.6 `Services/InfoServices/OrderInfo.cs` — ИЗМЕНИТЬ
В `GetEntityQueryableRepository()` добавить, до `.AsSplitQuery()`:
```csharp
                       // Контакты для связи (батч 2026-08-29): нужны и админской карточке,
                       // и письму, и Telegram — то есть на каждом чтении этого графа.
                       // Приведение к ICollection<> обязательно: Contacts объявлен HashSet<>.
                       .Include((Expression<Func<Order, ICollection<OrderContact>>>)(x => x.Contacts))
```

### 3.7 `Services/InfoServices/UserContactMethodInfo.cs` — СОЗДАТЬ
`EntityInfoBase<UserContactMethod>`, три конструктора по образцу `ExpenseTemplateInfo`.
Методы (владелец ВСЕГДА в предикате — IDOR невозможен по конструкции):
```csharp
        // Справочник одного пользователя. Порядок: основной первым, дальше по Id —
        // сортирует сервер, чтобы фронт и письмо не расходились.
        public async Task<List<UserContactMethod>> GetByUserAsync(int userId, CancellationToken cancellationToken = default);

        // userId в предикате обязателен: без него это был бы «дай любой контакт по id».
        public async Task<UserContactMethod> GetByIdAsync(int id, int userId, CancellationToken cancellationToken = default);
```

### 3.8 `Services/ValidationServices/UserContactMethodValidationService.cs` — СОЗДАТЬ
`internal class ... : EntityValidationContextDependentBase<UserContactMethod, ATToursContextFactory>`
(образец — `UserRegistrationValidationService`). В `ValidateEntitiesAsync` для каждой сущности:
- пустое `FirstName`/`LastName` → `RequiredFieldMissing` (2059), 400;
- `!ContactMethodValidator.IsValid(Type, Value)` → `InvalidContactValue` (2063), 400;
- количество строк пользователя в БД (исключая правимую по `Id`) `>= ContactLimits.MaxProfileContacts`
  → `TooManyContactMethods` (2065), 400.

### 3.9 `Services/CreateServices/UserContactMethodCreationService.cs` — СОЗДАТЬ
`CreateVerifiableEntityBase<UserContactMethod, ATToursContextFactory>`, образец —
`ExpenseTemplateCreationService` + `OrderCreationService.EnrichAsync`.
```csharp
public UserContactMethodCreationService(UserContactMethod entity, int userId, CancellationToken cancellationToken = default)
```
`ExecuteEntityChangesFactoryAsync`: сначала enrich, потом `base` (тот же порядок, что у заказа —
валидация обязана видеть уже нормализованное значение). Enrich:
- `entity.UserId = userId` (из токена, не из тела);
- `entity.Value = ContactMethodValidator.Normalize(entity.Type, entity.Value)`;
- `FirstName`/`LastName` — `Trim()`;
- если справочник пуст, `IsPrimary` принудительно `true` (первый контакт всегда основной —
  иначе профиль остался бы без основного и форме заказа нечем предзаполняться);
- если `IsPrimary == true` и справочник не пуст — снять флаг у остальных строк пользователя
  ДО добавления новой.
`GetEntityValidation()` → `new UserContactMethodValidationService([.. Entities], Context)`.

### 3.10 `Services/UpdateServices/UserContactMethodUpdateService.cs` — СОЗДАТЬ
`RepositoryCoreBase<UserContactMethod, ATToursContextFactory>`, образец — `UserPhoneUpdateService`.
```csharp
        // Правка своей строки справочника. Уже созданные заказы это НЕ трогает (ADR 032 Р1).
        public async Task<UserContactMethod> UpdateAsync(ContactMethodUpdateModel model, int userId);

        // Снять IsPrimary со всех строк пользователя и поставить целевой. Инвариант
        // «не больше одного основного» держится здесь, а не уникальным индексом (ADR 032 Р4).
        public async Task SetPrimaryAsync(int id, int userId);
```
Обе загружают строку по `x.Id == id && x.UserId == userId`; не найдено →
`ContactMethodNotFound` (2064), 404. Значение перед сохранением прогоняется через
`ContactMethodValidator.Normalize` и `UserContactMethodValidationService`, вызванный
напрямую (`new ...([entity], Context).ValidateEntitiesAsync()`) до `SaveChanges`.

### 3.11 `Services/DeleteServices/UserContactMethodDeletionService.cs` — СОЗДАТЬ
`RepositoryCoreBase<UserContactMethod, ATToursContextFactory>`, образец —
`ExpenseTemplateDeletionService`.
```csharp
        public async Task DeleteAsync(int id, int userId);
```
- строка ищется по `Id + UserId`, не найдено → `ContactMethodNotFound` (2064), 404;
- проверки «в использовании» НЕТ и быть не должно: заказы держат снимок, `CatalogEntryInUse`
  здесь неприменим (ADR 032 Р1);
- если удалялся основной и в справочнике остались строки — основной переезжает на первую
  оставшуюся по `Id` (профиль не должен остаться без основного);
- физический `EntityRepository.Delete(...)`, soft-delete не вводить.

### 3.12 `Notifications/OrderNotificationService.cs` — ИЗМЕНИТЬ
1. В `BuildValues`, в `switch (token)`, добавить ветку:
```csharp
                    case EmailPlaceholders.ClientContact:
                        values[token] = PlaceholderValue.Html(BuildClientContactHtml(order, language));
                        break;
```
2. Рядом с `BuildOrderLinesHtml` добавить:
```csharp
        // Все контакты заказа, ОСНОВНОЙ ПЕРВЫМ (порядок уже задан маппингом Order ->
        // OrderInfoModel, здесь не пересортировываем). Значения HTML-кодируются, как имя
        // тура в BuildOrderLinesHtml. Пустой список (заказы до батча 2026-08-29) — пустая
        // строка, а не подпись-заглушка.
        private static string BuildClientContactHtml(OrderInfoModel? order, LanguageCode language)
```
   Формат одной строки:
   `<p>{FirstName} {LastName} — {Type.ToLabel(language)}: {Value}{, «(основной)»/«(primary)» если IsPrimary}</p>`
   Подпись берётся из `NotificationLabels.For(NotificationLabels.PrimaryContact, language)` (§3.14).

### 3.13 `Notifications/OrderNotificationService.Telegram.cs` — ИЗМЕНИТЬ
В `BuildTelegramText`, **после** ветки `AppendEmployeeLines`/`AppendOrderLines` (то есть в
обоих режимах), вызвать новый метод:
```csharp
        // Тот же контент, что у {{ClientContact}} в письме, plaintext-вариантом: исполнитель
        // и админ получают уведомление в Telegram вместо/вместе с письмом, и «кому звонить»
        // не должно зависеть от транспорта.
        private static void AppendClientContacts(StringBuilder builder, OrderInfoModel order, LanguageCode language)
```
Каждый контакт — своя строка через существующий `AppendLine(builder, label, value)`, где
`label` = `contact.Type.ToLabel(language)`, `value` = `"{FirstName} {LastName}, {Value}"`;
основной идёт первым (порядок уже готов). `Truncate` не трогать — она применяется к итогу.

### 3.14 `Notifications/NotificationLabels.cs` — ИЗМЕНИТЬ
Добавить один токен в оба словаря:
```csharp
        public const string PrimaryContact = nameof(PrimaryContact);
```
RU: `"основной"`, EN: `"primary"`. Подписи самих способов связи сюда НЕ дублировать — они
живут в `ContactMethodTypeExtensions.ToLabel` (§1.8), у `NotificationLabels` другая
ответственность: подписи ПОЛЕЙ блока, а не значений enum'ов.

---

## 4. Токен письма `{{ClientContact}}`

### 4.1 `ATTours.Common/Constants/EmailPlaceholders.cs` — ИЗМЕНИТЬ
1. Константа:
```csharp
        // Контакты для связи с клиентом (батч 2026-08-29): все контакты заказа, основной
        // первым. HTML-токен — бэкенд строит разметку сам, как OrderLines и AssignmentDetails.
        public const string ClientContact = nameof(ClientContact);
```
2. Обновить комментарий шапки класса: HTML-токенов теперь ТРИ (`AssignmentDetails`,
   `OrderLines`, `ClientContact`).
3. В `TokensByKey` добавить `ClientContact` в:
   - `EmailActionKey.OrderCreated` — письмо админу о новой брони, главный адресат требования;
   - `EmailActionKey.OrderAutoCancelled` — тот же читатель и тот же набор, что у OrderCreated;
   - `EmailActionKey.OrderAssignEmployee` — водителю/гиду нужно, кому звонить в день выезда.

   В `OrderSendToClient` токен НЕ добавлять: письмо адресовано самому клиенту, показывать ему
   его же контакты незачем. В `OrderUnassignEmployee` — тоже нет: снятому исполнителю звонить
   клиенту уже не нужно.

---

## 5. ATTours.DataLayer

### 5.1 `ATToursContext.cs` — ИЗМЕНИТЬ
Добавить два `DbSet` в конец списка:
```csharp
        public DbSet<UserContactMethod> UserContactMethods { get; set; }
        public DbSet<OrderContact> OrderContacts { get; set; }
```

### 5.2 Миграция `AddClientContacts` — СОЗДАТЬ
**ПЕРЕД генерацией — обязательный порядок действий:**
1. `git status`. Если в `ATTours.Common/Entities/` или в
   `ATTours.DataLayer/Migrations/ATToursContextModelSnapshot.cs` есть ЧУЖИЕ незакоммиченные
   изменения — **остановиться и спросить Давида**, а не генерировать поверх чужой модели.
   Прецедент 2026-08-28: `dotnet ef migrations add` при грязном дереве утянул в миграцию
   чужие незакоммиченные сущности.
2. Свои изменения по §1 закоммитить (или как минимум убедиться, что в дереве только они).
3. `dotnet ef migrations add AddClientContacts --project ATTours.DataLayer --startup-project ATTours.ClientAPI`
4. Проверить сгенерированный `Up()`: в нём должны быть **ровно две** `CreateTable`
   (`UserContactMethod`, `OrderContact`) и их индексы. Любая посторонняя операция —
   признак того, что в снапшот попала чужая модель: удалить миграцию и вернуться к п. 1.

Состояние дерева на момент написания спецификации (2026-08-29, проверено): в работе
параллельный батч (Telegram-линковка, Jobs, SiteSettings). Он трогает три файла из §9
(`ATTours.ClientAPI/Controllers/AccountController.cs`, `ATTours.ClientAPI/Mapper/MappingProfile.cs`,
`ATTours.Common/DTO/Info/OrderInfoModel.cs`) — правки не пересекаются построчно, но мержить
внимательно. `ATTours.Common/Entities/` и `ATTours.DataLayer/Migrations/` НЕ тронуты, поэтому
генерация миграции на этот момент безопасна; п. 1 всё равно выполнить заново.

Содержимое схемы:
- `UserContactMethod`: `Id` (identity PK), `UserId` (int, FK → `User.Id`, ON DELETE CASCADE),
  `Type` (int), `Value` (nvarchar(254) NOT NULL), `FirstName`/`LastName` (nvarchar(128) NOT NULL),
  `IsPrimary` (bit); индекс `IX_UserContactMethod_UserId`.
- `OrderContact`: `Id` (identity PK), `OrderId` (int, FK → `Order.Id`, ON DELETE CASCADE),
  `Type` (int), `Value` (nvarchar(254) NOT NULL), `FirstName`/`LastName` (nvarchar(128) NOT NULL),
  `IsPrimary` (bit), `SortOrder` (int); индекс `IX_OrderContact_OrderId`.

Бэкфилла существующих заказов НЕТ (§0 п. 8).

### 5.3 Дописать `{{ClientContact}}` в боевые шаблоны — В ТОЙ ЖЕ миграции, вручную
После сгенерированного кода в `Up()` добавить SQL-блок (прецедент —
`NotificationRecipientsAndBilingualTemplates`: схема + данные в одной миграции).
Идемпотентно (`NOT LIKE`), чтобы повторный прогон на среде, где строку уже дописали руками
через админку, не задвоил её:
```csharp
            // Дописываем блок контактов в боевые шаблоны писем, где токен объявлен
            // (OrderCreated = 1, OrderAssignEmployee = 2, OrderAutoCancelled = 5).
            migrationBuilder.Sql(@"
                UPDATE [EmailTemplate]
                SET [BodyHtml] = [BodyHtml] + N'<p><b>Контакт для связи:</b></p>{{ClientContact}}'
                WHERE [ActionKey] IN (1, 2, 5)
                  AND [BodyHtml] IS NOT NULL
                  AND [BodyHtml] NOT LIKE N'%{{ClientContact}}%';");

            migrationBuilder.Sql(@"
                UPDATE [EmailTemplate]
                SET [BodyHtmlEn] = [BodyHtmlEn] + N'<p><b>Contact for communication:</b></p>{{ClientContact}}'
                WHERE [ActionKey] IN (1, 2, 5)
                  AND [BodyHtmlEn] IS NOT NULL
                  AND [BodyHtmlEn] NOT LIKE N'%{{ClientContact}}%';");
```
В `Down()` — симметричный `REPLACE(...)` тех же двух блоков на пустую строку, ДО `DropTable`.

---

## 6. ATTours.ClientAPI

### 6.1 `Controllers/OrderController.cs` — ИЗМЕНИТЬ
Единственная правка — вызов сервиса в `CreateAsync`:
```csharp
            using (var creationService = new OrderCreationService(model, User.GetUserId(), cancellationToken))
```
(было `model.Lines`). `CreateTransferRequestAsync`, `GetMine`, `GetAll`, `{id:int}` НЕ меняются:
контакты приезжают внутри уже существующего `OrderInfoModel`. try/catch не добавлять — отказ
по контактам едет тем же `ATToursExceptionMaster`, что и остальные `ErrorModelException`.

### 6.2 `Controllers/AccountController.cs` — ИЗМЕНИТЬ
Добавить пять эндпоинтов справочника. Контроллер уже `[Authorize]`, id — только из токена,
сервисы создаются через `new` + `using` (стиль проекта, ADR 005: в конструкторе только то,
чему нужен DI).

| Метод | Маршрут | Тело / параметры | Ответ | Коды отказа |
| --- | --- | --- | --- | --- |
| `GET` | `api/Account/Contacts` | — | `List<ContactMethodInfoModel>` (основной первым) | — |
| `POST` | `api/Account/Contacts` | `ContactMethodCreateModel` | `ContactMethodInfoModel` | 2059, 2063, 2065 |
| `PUT` | `api/Account/Contacts` | `ContactMethodUpdateModel` | `ContactMethodInfoModel` | 2059, 2063, 2064 |
| `DELETE` | `api/Account/Contacts` | `?id=` | `204 NoContent` | 2064 |
| `PATCH` | `api/Account/Contacts/SetPrimary` | `?id=` | `List<ContactMethodInfoModel>` | 2064 |

Формы методов — как у `UpdatePhoneAsync`/`UnlinkTelegramAsync` рядом в этом же файле.
`GET` возвращает `UserContactMethodInfo.GetByUserAsync(User.GetUserId(), ct)` через
`mapper.Map<List<ContactMethodInfoModel>>`. `PATCH` после `SetPrimaryAsync` перечитывает
справочник и отдаёт его целиком — экрану всё равно нужен новый порядок, а второй round-trip
на «а кто теперь основной» лишний.

Комментарий над блоком:
```csharp
        // Справочник способов связи (батч 2026-08-29). Self-service, как и остальной
        // AccountController: userId только из токена, поэтому чужой контакт этими
        // эндпоинтами не достать. Правка/удаление строки НЕ меняют уже созданные заказы —
        // там лежит снимок значений (ADR 032).
```

### 6.3 `Mapper/MappingProfile.cs` — ИЗМЕНИТЬ
Рядом с блоком заказа (после `CreateMap<Order, OrderInfoModel>()`, ~строка 772):
```csharp
            // Контакты заказа — ОСНОВНОЙ ПЕРВЫМ, дальше по SortOrder, который проставил
            // сервер при создании. Порядок задаётся здесь, а не на фронте: тот же список в
            // том же порядке уезжает в письмо, в Telegram и в админскую карточку.
            CreateMap<OrderContact, OrderContactInfoModel>();
```
и в `CreateMap<Order, OrderInfoModel>()` добавить:
```csharp
                .ForMember(dest => dest.Contacts, opt => opt.MapFrom(src =>
                    src.Contacts.OrderByDescending(contact => contact.IsPrimary)
                                .ThenBy(contact => contact.SortOrder)))
```
Рядом с блоком пользователя (после `CreateMap<User, UserInfoModel>()`, ~строка 855):
```csharp
            CreateMap<UserContactMethod, ContactMethodInfoModel>();
            CreateMap<ContactMethodCreateModel, UserContactMethod>();
            CreateMap<ContactMethodUpdateModel, UserContactMethod>();
```
Маппинга `OrderContactCreateModel -> OrderContact` НЕТ: контакты собирает
`OrderContactBuilder`, как и всю остальную форму заказа собирает сервис создания, а не маппер.

---

## 7. Что отдаётся наружу

| Эндпоинт | Контакты в ответе |
| --- | --- |
| `GET api/Order/{id}` (админ, карточка заказа) | да, основной первым |
| `GET api/Order/GetAll` (админский список) | да (граф `OrderInfo` один на все чтения) |
| `GET api/Order/GetMine` (клиент) | да — свои же контакты |
| `GET api/Order/GetAssignedToMe` (исполнитель) | да — водителю/гиду нужно, кому звонить |
| `POST api/Order/Create`, `POST api/Order/CreateTransferRequest` | да (ответ — тот же `OrderInfoModel`) |

Отдельного эндпоинта «контакты заказа» НЕТ и не нужно: список короткий (≤3) и едет внутри
уже читаемого графа — в отличие от журнала заказа (`{id}/Events`), который вынесен отдельно
осознанно (ADR 020 §4).

---

## 8. Вне скоупа этой задачи (явно)

- **Ручное создание заказа админом** — эндпоинта и экрана нет; правило контактов достанется
  ему автоматически, когда он появится и прогонит `OrderValidationService`.
- **Правка контактов уже созданного заказа** — эндпоинта нет, снимок неизменен (ADR 032 Р1).
- **Событие журнала заказа** про контакты (`OrderEventType`) — не заводится: контакты
  задаются один раз при создании и не меняются, менять в журнале нечего.
- **PDF документа заказа и персонального задания** — контакты туда не добавляются.
- **`OrderSendToClient` / `OrderUnassignEmployee`** — токен `{{ClientContact}}` им не выдаётся (§4.1).
- **Бэкфилл контактов существующим заказам** — не делается.
- **Мультиязычность контактов** (`ITranslatableModel`) — не применяется.
- **Весь фронтенд** (личный кабинет, блок в корзине, шаг 3 мастера, админская карточка,
  кнопка «Заполнить из профиля») — Фазы 3-6 чек-листа, отдельные задачи.
- **Telegram `setWebhook` на проде** — висит отдельно, к этой задаче отношения не имеет.

---

## 9. Полный список файлов

**Создать (20):**

| Проект | Файл |
| --- | --- |
| Common | `Enums/ContactMethodType.cs` |
| Common | `Entities/UserContactMethod.cs` |
| Common | `Entities/OrderContact.cs` |
| Common | `Infrastructure/EntityConfiguration/UserContactMethodConfiguration.cs` |
| Common | `Infrastructure/EntityConfiguration/OrderContactConfiguration.cs` |
| Common | `Constants/ContactLimits.cs` |
| Common | `Extensions/ContactMethodTypeExtensions.cs` |
| Common | `DTO/Init/OrderContactCreateModel.cs` |
| Common | `DTO/Info/OrderContactInfoModel.cs` |
| Common | `DTO/Account/ContactMethodInfoModel.cs` |
| Common | `DTO/Account/ContactMethodCreateModel.cs` |
| Common | `DTO/Account/ContactMethodUpdateModel.cs` |
| Service | `Services/Shared/ContactMethodValidator.cs` |
| Service | `Services/Shared/OrderContactBuilder.cs` |
| Service | `Services/InfoServices/UserContactMethodInfo.cs` |
| Service | `Services/ValidationServices/UserContactMethodValidationService.cs` |
| Service | `Services/CreateServices/UserContactMethodCreationService.cs` |
| Service | `Services/UpdateServices/UserContactMethodUpdateService.cs` |
| Service | `Services/DeleteServices/UserContactMethodDeletionService.cs` |
| DataLayer | `Migrations/<timestamp>_AddClientContacts.cs` (+ `.Designer.cs`, обновлённый снапшот) |

**Изменить (17):**

| Проект | Файл | Что |
| --- | --- | --- |
| Common | `Entities/Order.cs` | коллекция `Contacts` |
| Common | `DTO/Init/OrderCreateModel.cs` | список `Contacts` |
| Common | `DTO/Init/CustomTransferRequestCreateModel.cs` | список `Contacts` |
| Common | `DTO/Info/OrderInfoModel.cs` | список `Contacts` |
| Common | `Constants/EmailPlaceholders.cs` | токен `ClientContact` + реестр по событиям |
| Helper | `Enums/GlobalErrorCode.cs` | коды 2060-2065 |
| Service | `Services/ValidationServices/OrderValidationService.cs` | `ValidateContacts` |
| Service | `Services/CreateServices/OrderCreationService.cs` | приём модели целиком + сборка контактов |
| Service | `Services/CreateServices/CustomTransferRequestCreationService.cs` | сборка контактов |
| Service | `Services/InfoServices/OrderInfo.cs` | `Include(Contacts)` |
| Service | `Notifications/OrderNotificationService.cs` | ветка токена + `BuildClientContactHtml` |
| Service | `Notifications/OrderNotificationService.Telegram.cs` | `AppendClientContacts` |
| Service | `Notifications/NotificationLabels.cs` | подпись `PrimaryContact` |
| DataLayer | `ATToursContext.cs` | два `DbSet` |
| ClientAPI | `Controllers/OrderController.cs` | новый вызов `OrderCreationService` |
| ClientAPI | `Controllers/AccountController.cs` | пять эндпоинтов справочника |
| ClientAPI | `Mapper/MappingProfile.cs` | четыре маппинга + `Contacts` в `OrderInfoModel` |

**Не трогать:** `ATTours.Common/Entities/User.cs`, `ATTours.ContextRepository` (новых
абстракций репозитория не требуется — хватает существующих `EntityInfoBase` /
`RepositoryCoreBase` / `CreateVerifiableEntityBase` / `EntityValidationContextDependentBase`),
`ATTours.Helper` кроме `GlobalErrorCode`, `OrderUpdateService`, `OrderLineService`,
`OrderDeletionService` (контакты уезжают каскадом).

---

## 10. Проверка перед сдачей

1. `dotnet build -c Release` из `Hay Travel/Backend`.
2. `POST api/Order/Create` без `contacts` → 400 с кодом **2060** (плоский `ErrorModel`,
   БЕЗ массива `lines`).
3. `POST api/Order/Create` с 4 контактами → 400/**2061**; с двумя `isPrimary` → 400/**2062**;
   с `type: 1, value: "89261234567"` → 400/**2063**.
4. `POST api/Order/CreateTransferRequest` — те же четыре проверки, те же коды.
5. Успешный `Create` → в ответе `contacts` непустой, основной ПЕРВЫЙ, значения нормализованы.
6. `PUT api/Account/Contacts` меняет строку справочника → повторный `GET api/Order/{id}`
   ранее созданного заказа показывает СТАРЫЕ значения (главная проверка ADR 032 Р1).
7. `DELETE api/Account/Contacts` удаляет строку → тот же заказ читается без ошибок и без
   изменений.
8. Письмо `order.created` в dev (`DevEmailSender`) содержит блок контактов, основной первым.
