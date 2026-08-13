# Spec 002. Backend-контракт дизайн-настроек: пресет палитры + мягкий дефолт dark/light

- **Дата:** 2026-08-11
- **Автор:** Backend Architect
- **Исполнитель:** backend-developer
- **Связанный ADR:** [013-theme-palette-preset-as-sitesetting-select.md](../adr/013-theme-palette-preset-as-sitesetting-select.md)
- **Ориентир (существующий вертикальный срез):** механизм `SiteSetting` целиком —
  `SiteSettingCatalog` + `SiteSettingDefinition` + `SiteSettingsInfo`/`SiteSettingsUpdateService`/
  `SiteSettingsValidationService` + `ApplyCatalogMetadata` в `MappingProfile`. Новой сущности,
  репозитория, контроллера и миграции НЕТ — задача добавляет два ключа в существующий механизм
  и один новый тип контрола (`Select`). Действуй строго по образцу того, как в каталоге уже
  заведены ключи `content.*`, и как метаданные текут в админку через `SiteSettingInfoModel`.

## Что делаем (итог)

Два новых ключа настроек, оба в новой группе `Theme`, оба публичные и язык-нейтральные:

| Key | Тип | Значение | Default | IsPublic | IsTranslatable |
| --- | --- | --- | --- | --- | --- |
| `theme.activePalette` | `Select` | id пресета палитры | `obsidian` | true | false |
| `theme.defaultMode`   | `Select` | `dark` / `light`   | `dark`    | true | false |

Список допустимых пресетов палитры — статический каталог в коде (`ThemePaletteCatalog`).
На старте в нём один известный пресет — `obsidian` (текущий обсидиан+золото). Новые пресеты
дизайнер/frontend добавят позже одной строкой каталога + CSS — это вне скоупа этой задачи.

Значение `Select`-ключа валидируется на сервере против списка опций: неизвестный id/режим →
`400 SiteSettingValueNotAllowed`.

## Миграция

**Не нужна.** Следствие ADR 002: новые ключи — строки каталога, новые члены enum, новое поле
DTO `Options` — всё это только код. Ни изменения схемы, ни `HasData`/сида. Не создавай миграцию.

## Мультиязычность

Оба ключа `IsTranslatable = false` — id пресета и режим язык-нейтральны, хранятся в
`SiteSetting.Value`, без `SiteSettingTranslation`. Переводимы только **подписи опций** для
админки (`Label`), и то опционально — см. решение ниже: подпись опции — простая строка, не
`TranslatableInfoModel`. RU/EN-валидация переводимых ключей на эти ключи не распространяется.

## Связи с другими сущностями

Нет. Ключи ни на что не ссылаются. `ThemePaletteCatalog` — код-каталог, не таблица, FK нет.

---

## Файлы по проектам

### ATTours.Common

**1. `Enums/SiteSettingGroup.cs` — ИЗМЕНИТЬ.**
Добавить член в конец enum:
```
Theme = 7,
```
Комментарием отметить: тема оформления сайта (палитра + дефолтный режим), отдельно от
`Branding` (там только логотип). Инвариант «Key начинается с имени группы в нижнем регистре +
точка» сохраняется: группа `Theme` → ключи `theme.*`.

**2. `Enums/SettingValueType.cs` — ИЗМЕНИТЬ.**
Добавить член:
```
Select = 5,
```
Комментарий: значение — один id из фиксированного набора опций (`Options` в метаданных),
рендерится в админке как выпадающий список. Тип хранения по-прежнему строка.

**3. `Infrastructure/SiteSettings/SiteSettingOption.cs` — СОЗДАТЬ.**
Модель одной опции Select-настройки. Живёт в коде рядом с `SiteSettingDefinition`.
```csharp
public class SiteSettingOption
{
    public SiteSettingOption(string value, string label)
    {
        Value = value;
        Label = label;
    }

    // Технический id, который уходит в SiteSetting.Value (например "obsidian", "dark").
    public string Value { get; }

    // Подпись для админки (например "Обсидиан + золото", "Тёмная"). Admin-facing,
    // не публикуется на сайте, поэтому простая строка, а не перевод.
    public string Label { get; }
}
```

**4. `Infrastructure/SiteSettings/SiteSettingDefinition.cs` — ИЗМЕНИТЬ.**
Добавить в конструктор опциональный последний параметр и свойство:
```csharp
// в сигнатуру ctor, ПОСЛЕДНИМ параметром:
IReadOnlyList<SiteSettingOption> options = null

// в теле ctor:
Options = options ?? Array.Empty<SiteSettingOption>();

// свойство:
// Допустимые опции для ValueType.Select. Пусто для всех остальных типов.
public IReadOnlyList<SiteSettingOption> Options { get; }
```
Параметр последний и опциональный — существующие позиционные вызовы каталога
(`defaultValue:`/`defaultTranslations:` идут именованными) не ломаются.

**5. `Infrastructure/SiteSettings/ThemePaletteCatalog.cs` — СОЗДАТЬ.**
Единственный источник правды по допустимым id палитр. По образцу `SiteSettingCatalog`
(статический класс, `IReadOnlyList`, поиск по id — `StringComparer.Ordinal`).
```csharp
public static class ThemePaletteCatalog
{
    // На старте один известный пресет — текущий обсидиан+золото.
    // Новый пресет = одна строка сюда + соответствующий CSS на фронте, без миграции.
    private static readonly IReadOnlyList<SiteSettingOption> palettes =
    [
        new("obsidian", "Обсидиан + золото"),
    ];

    // Отдаётся как Options для ключа theme.activePalette.
    public static IReadOnlyList<SiteSettingOption> Options => palettes;

    public static bool IsKnown(string id) =>
        id is not null && palettes.Any(p => string.Equals(p.Value, id, StringComparison.Ordinal));
}
```
Дефолтный id пресета зафиксирован как `obsidian` — не на усмотрение разработчика. Точную
строку id согласует frontend-architect для CSS; при расхождении менять здесь и в CSS
синхронно, но менять НЕ в рамках этой задачи.

**6. `Infrastructure/SiteSettings/SiteSettingCatalog.cs` — ИЗМЕНИТЬ.**
Добавить два ряда в конец списка `definitions` (после `content.largeGroupInvitation`),
`sortOrder` — следующие свободные глобальные номера (24, 25), по правилу из комментария у
`seo.faviconUrl` (глобальная последовательность, не переномерация):
```csharp
// ---- Theme ----
new("theme.activePalette", SiteSettingGroup.Theme, SettingValueType.Select,
    isTranslatable: false, isPublic: true, sortOrder: 24,
    defaultValue: "obsidian",
    options: ThemePaletteCatalog.Options),

new("theme.defaultMode",   SiteSettingGroup.Theme, SettingValueType.Select,
    isTranslatable: false, isPublic: true, sortOrder: 25,
    defaultValue: "dark",
    options:
    [
        new SiteSettingOption("dark",  "Тёмная"),
        new SiteSettingOption("light", "Светлая"),
    ]),
```

**7. `DTO/Info/SiteSettingOptionModel.cs` — СОЗДАТЬ.**
Транспортная модель опции для админки.
```csharp
public class SiteSettingOptionModel
{
    public string Value { get; set; }
    public string Label { get; set; }
}
```

**8. `DTO/Info/SiteSettingInfoModel.cs` — ИЗМЕНИТЬ.**
В блок «Метаданные из SiteSettingCatalog» добавить:
```csharp
// Список опций для ValueType.Select (иначе пустой список). Из каталога, в БД не хранится.
public List<SiteSettingOptionModel> Options { get; set; } = [];
```
`SiteSettingUpdateModel` НЕ трогаем — Select-ключи присылают `Key` + `Value`, `Translations`
пустой, как любой непереводимый ключ.

### ATTours.Service (ATTours.BusinessServices)

**9. `Services/ValidationServices/SiteSettingsValidationService.cs` — ИЗМЕНИТЬ.**
После существующей проверки «ключ известен» и до/после `ValidateTranslations` добавить проверку
значения для Select-ключей. Логика:
- получить `var definition = SiteSettingCatalog.ByKey(entity.Key);` (ключ уже проверен на
  известность выше — definition не null);
- если `definition.ValueType == SettingValueType.Select`:
  - пустое значение (`null`/whitespace) — допустимо (ещё не выбрано, отдастся default);
  - непустое значение обязано присутствовать среди `definition.Options` по `Value`
    (сравнение `StringComparer.Ordinal`); иначе:
    ```csharp
    throw new ErrorModelException(GlobalErrorCode.SiteSettingValueNotAllowed,
        HttpStatusCode.BadRequest,
        $"Site setting '{entity.Key}' has value '{entity.Value}' that is not an allowed option.");
    ```
Не хардкодь список пресетов/режимов в валидаторе — проверяй строго против `definition.Options`
(для `theme.activePalette` они приходят из `ThemePaletteCatalog`, что и даёт защиту от
неизвестного id пресета).

`SiteSettingsInfo`, `SiteSettingsUpdateService`, `SiteSettingsController` — БЕЗ изменений:
слияние каталог⟵БД, upsert по Key и GetAll/Update/GetPublic уже generic по ключам.

### ATTours.Helper

**10. `Enums/GlobalErrorCode.cs` — ИЗМЕНИТЬ.**
В регион `EntityErrors`, следующий свободный номер после `ExchangeRatesUnavailable = 2012`:
```csharp
[Description("Site setting value is not an allowed option.")]
SiteSettingValueNotAllowed = 2013,
```

### ATTours.ClientAPI

**11. `Mapper/MappingProfile.cs` — ИЗМЕНИТЬ.**
В `ApplyCatalogMetadata(SiteSetting, SiteSettingInfoModel)` дописать перенос опций после
существующих метаданных:
```csharp
destination.Options = definition.Options
    .Select(o => new SiteSettingOptionModel { Value = o.Value, Label = o.Label })
    .ToList();
```
Это осознанное исключение из правила «маппер только перекладывает поля» — то же, что уже
делается для `Group`/`ValueType`/`SortOrder` (каталог — константа, без DI и состояния).
Отдельный `CreateMap<SiteSettingOption, SiteSettingOptionModel>` не обязателен (ручной проброс
внутри `ApplyCatalogMetadata`), но допустим, если удобнее — на выбор реализатора.

---

## Контракты (итоговая форма для фронта)

`GET api/SiteSettings/GetAll` (admin) — в ответе для ключей `theme.activePalette` /
`theme.defaultMode`:
```jsonc
{
  "id": 0,                         // 0 пока не сохранён
  "key": "theme.activePalette",
  "group": 7,                      // SiteSettingGroup.Theme
  "valueType": 5,                  // SettingValueType.Select
  "isTranslatable": false,
  "isPublic": true,
  "sortOrder": 24,
  "value": "obsidian",            // сохранённое или default
  "translations": [],
  "options": [
    { "value": "obsidian", "label": "Обсидиан + золото" }
  ]
}
```

`PUT api/SiteSettings/Update` — payload как у любого непереводимого ключа:
```jsonc
{ "key": "theme.defaultMode", "value": "light", "translations": [] }
```
Неизвестный `value` (например `"neon"` для палитры) → `400`, код `2013`
`SiteSettingValueNotAllowed`. Неизвестный `key` → прежний `400` `2005`.

`GET api/SiteSettings/GetPublic?languageCode=..&group=7` — клиентский сайт получает оба ключа
в плоском словаре `{ "theme.activePalette": "obsidian", "theme.defaultMode": "dark" }`
(значение уже разрешено `Value ?? default`).

---

## Вне скоупа (не делать в этой задаче)

- Реальные цвета/CSS-переменные пресетов, шрифты, дизайн новой палитры — зона дизайнера и
  frontend-architect (Spec 001 / параллельно).
- Второй и последующие пресеты в `ThemePaletteCatalog` — добавит дизайнер/frontend позже одной
  строкой; сейчас в каталоге только `obsidian`.
- Фронтовое применение: рендер `<select>` для `ValueType.Select`, копирайт карточки «Тема» в
  `settingsCopy.ts`, применение `theme.activePalette` к `data-theme`/классу, использование
  `theme.defaultMode` как seed при отсутствии сохранённого выбора пользователя, сохранение
  рабочего клиентского переключателя — всё это frontend-architect/frontend-developer.
- Изменение группы `Branding`, миграции, сиды, новые эндпоинты, новая сущность/таблица — не
  делаются (см. ADR 013 и раздел «Миграция»).
