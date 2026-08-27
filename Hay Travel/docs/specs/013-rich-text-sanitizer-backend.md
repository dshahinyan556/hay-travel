# Спецификация 013. Санитайзер rich-text: картинки в письмах, свободный цвет, абсолютные media-URL

- **Дата:** 2026-08-22
- **Автор:** backend-architect
- **Исполнитель:** `backend-developer`
- **Постановка:** [спека 012](012-rich-text-editor-backend-requirements.md) (frontend-architect)
- **Почему так:** [ADR 026](../adr/026-html-sanitization-profiles-and-send-time-absolutization.md)
- **Фронтовая часть:** [спека 011](011-rich-text-editor.md) — **не выкатывается в прод раньше этой**
- **Меняемый контракт документации:** [architecture-role-notifications.md §E.5](../architecture-role-notifications.md)

> Ориентир по стилю кода — существующий вертикальный срез шаблонов писем:
> `EmailTemplateValidationService` → `EmailTemplateUpdateService` → `OrderNotificationService`.
> Все решения приняты, открытых вопросов «на усмотрение разработчика» в этой спеке нет.

---

## 0. Что делаем одним предложением

Выносим конфигурацию санитайзера в `ATTours.Service/Html/`, разрешаем `<img>` с проверкой `src`
и `width`, валидируем и канонизируем значения CSS, абсолютизируем `/uploads/...` в момент
отправки письма, добавляем потолок длины тела шаблона.

**Миграция EF не нужна.** Схема БД не меняется, `BodyHtml` остаётся `nvarchar(max)`.
**Мультиязычность не применяется:** `EmailTemplate` — не `ITranslatableModel`, шаблон один на
действие (`ActionKey`), это существующее решение и оно не пересматривается.
**DI не трогаем:** новые классы статические, `DependencyInjectionConfiguration` не меняется.

---

## 1. Файлы по проектам

### `ATTours.Service` (`ATTours.BusinessServices`)

| Путь | Действие | Что внутри |
| --- | --- | --- |
| `ATTours.Service/Html/HtmlContentProfile.cs` | создать | `public enum HtmlContentProfile { EmailBody = 1, RichContent = 2 }` |
| `ATTours.Service/Html/HtmlContentPolicy.cs` | создать | Единственное место с allow-list'ом и правилами значений (§2) |
| `ATTours.Service/Html/RichHtmlSanitizer.cs` | создать | Публичный фасад: `Sanitize`, `ToPlainText` (§3) |
| `ATTours.Service/Html/MediaUrlAbsolutizer.cs` | создать | Абсолютизация `src`/`href` на отправке (§5) |
| `ATTours.Service/Services/ValidationServices/EmailTemplateValidationService.cs` | изменить | Удалить `SanitizeBodyHtml`, `SanitizeSubject`, `CreateBodySanitizer`, `Replace` и все четыре `Allowed*`-массива; добавить правило длины тела (§6) |
| `ATTours.Service/Services/UpdateServices/EmailTemplateUpdateService.cs` | изменить | Звать `RichHtmlSanitizer` вместо `EmailTemplateValidationService`; предпроверка длины сырого входа (§6) |
| `ATTours.Service/Notifications/OrderNotificationService.cs` | изменить | Абсолютизация тела в `SendAsync` + warning при отсутствующей базе (§5) |

Namespace — по существующей конвенции проекта (`ATTours.Service/Files/` →
`ATTours.BusinessServices.Files`), то есть `ATTours.BusinessServices.Html`.

### `ATTours.Common`

| Путь | Действие | Что внутри |
| --- | --- | --- |
| `ATTours.Common/Settings/EmailSettings.cs` | изменить | Свойство `PublicMediaBaseUrl` с фолбэком (§5.2) |

### `ATTours.ClientAPI`

| Путь | Действие | Что внутри |
| --- | --- | --- |
| `ATTours.ClientAPI/appsettings.json` | изменить | Добавить `Email:PublicMediaBaseUrl`; починить протухшие netlify-значения (§5.3) |
| `ATTours.ClientAPI/appsettings.Development.json` | изменить | Добавить `Email:PublicMediaBaseUrl: "http://localhost:5253"` |

### Корень репозитория

| Путь | Действие | Что внутри |
| --- | --- | --- |
| `docker-compose.yml` | изменить | `Email__PublicMediaBaseUrl: ${PUBLIC_BASE_URL}` в `environment` сервиса `backend` |

### `ATTours.ContextRepository`, `ATTours.DataLayer`, `ATTours.Helper`

Не меняются вообще. Если по ходу работы кажется, что нужно тронуть репозиторий или контекст —
это ошибка, вернись к спеке.

---

## 2. `HtmlContentPolicy` — единственная точка правды

Внутренний статический класс. Здесь и только здесь лежит всё, что «разрешено».

### 2.1. Allow-list (профиль `EmailBody`; `RichContent` пока указывает на ту же запись)

```
Теги:      p, br, strong, b, em, i, u, s, span, a, ul, ol, li, h1, h2, h3, blockquote, img
Атрибуты:  href, target, rel, style, src, alt, width
CSS:       color, font-size, font-weight, text-decoration, text-align
Схемы:     http, https, mailto
URI-атр.:  href, src
```

Изменения относительно текущего кода: `+ img`, `+ src`, `+ alt`, `+ width`, `+ src` в
`UriAttributes`. Всё остальное — как есть.

`AllowDataAttributes = false` (как сейчас) и **явно** `AllowCssCustomProperties = false`.

Не добавлять: `style` у `img`, `srcset`, `loading`, `class`, `id`, `data-*`, схемы
`data:`/`javascript:`/`vbscript:`/`file:`, теги `figure`, `figcaption`, `picture`, `source`,
`table`.

`HtmlSanitizer` ведёт allow-list атрибутов глобально, а не по тегам — это нормально и уже
объяснено в существующем комментарии к `AllowedAttributes`: `src`/`alt`/`width` осмысленны только
на `img`, а теги, где они могли бы навредить (`script`, `iframe`, `input`), в allow-list не
входят и вырезаются вместе с содержимым.

### 2.2. Проверка `src` картинки

```csharp
internal static bool IsAllowedImageSource(string? src)
```

`true` ровно в двух случаях:

1. Значение парсится как **абсолютный** URI со схемой `http` или `https`.
2. Значение начинается с `UploadSettings.PublicUrlPrefix + "/"` (то есть `"/uploads/"`), длиннее
   этого префикса, и **не** содержит: `..`, `//`, `\`, символов с кодом < 0x20, `:` до первого
   `/`.

Всё остальное — `false`: `//evil.com/a.png`, `../../x.png`, `data:image/svg+xml;base64,…`,
`javascript:alert(1)`, пустая строка, `null`.

Сравнение префикса — `StringComparison.Ordinal`. Константу `"/uploads"` не хардкодить: брать
`UploadSettings.PublicUrlPrefix` (`ATTours.Common.Settings`).

### 2.3. Проверка `width`

```csharp
internal static bool IsAllowedImageWidth(string? width)
```

`int.TryParse` с `CultureInfo.InvariantCulture` и `NumberStyles.None` (то есть без знака, без
разделителей), результат в диапазоне `1..1200`. `"600px"`, `"+600"`, `"1e3"`, `"0"`, `"99999"`,
пустое — `false`.

### 2.4. Значения CSS: валидация **и канонизация**

```csharp
/// <summary>Возвращает каноническое значение объявления или null, если объявление надо удалить.</summary>
internal static string? NormalizeCssValue(string property, string value)
```

`property` приходит в нижнем регистре. Таблица:

| Свойство | Принимаем | Храним |
| --- | --- | --- |
| `color` | `#rgb`, `#rrggbb`, `rgb(r,g,b)`, `rgba(r,g,b,a)` — компоненты целые `0..255`, альфа `1`/`1.0`/`100%` (непрозрачная); пробелы вокруг запятых любые | `#rrggbb`, нижний регистр |
| `font-size` | целое `1..96` + `px`, регистр `px` любой | `NNpx` |
| `font-weight` | `normal`, `bold` (любой регистр) либо целое `100..900`, кратное 100 | нижний регистр / само число |
| `text-decoration` | `none`, `underline`, `line-through` (любой регистр) | нижний регистр |
| `text-align` | `left`, `center`, `right`, `justify` (любой регистр) | нижний регистр |
| любое другое имя | — | `null` (удалить) |

`null` (удалить объявление) на всём остальном, в том числе: `var(...)`, `calc(...)`,
`color-mix(...)`, `url(...)`, `expression(...)`, `attr(...)`, любое значение с `!important`,
именованные цвета в буквенной форме, `currentColor`, `transparent`, `rgba` с полупрозрачной
альфой, любые единицы кроме `px` у размера, значения с `;`.

Регулярки — через `[GeneratedRegex]` (partial-класс), как это уже сделано в
`OrderNotificationService.PlaceholderRegex()`. Не собирать `new Regex(...)` в цикле.

> **Почему `rgb()` принимается наравне с hex.** AngleSharp внутри `HtmlSanitizer` пересобирает
> `style` из CSSOM и нормализует цвет, поэтому наш обработчик может увидеть `rgb(29, 77, 216)`
> там, где автор писал `#1d4ed8`. Отвергнуть эту форму = молча терять цвет при каждом втором
> сохранении. Канонизация обратно в hex нужна, чтобы `PUT`→`GET`→`PUT` давал побайтово
> одинаковый HTML (пункт приёмки §7.3) и чтобы фронт получал ровно контракт спеки 011 §3.10.
> Подробнее — ADR 026, решение 3.

---

## 3. `RichHtmlSanitizer` — фасад

```csharp
public static class RichHtmlSanitizer
{
    /// <summary>Санитизация rich-контента по профилю. Пустой/пробельный вход -> string.Empty.</summary>
    public static string Sanitize(string html, HtmlContentProfile profile);

    /// <summary>Снять всю разметку, оставив текст (тема письма). Сущности разворачиваются обратно, результат Trim'ится.</summary>
    public static string ToPlainText(string html);
}
```

`ToPlainText` — это дословный переезд текущего `EmailTemplateValidationService.SanitizeSubject`
(пустые allow-list'ы, `KeepChildNodes = true`, `WebUtility.HtmlDecode`, `Trim`). Логику не менять.

### 3.1. Как собирается санитайзер в `Sanitize`

1. `new HtmlSanitizer()` — **новый инстанс на каждый вызов**, не кешировать в static-поле.
   Библиотека не гарантирует потокобезопасность, а на обработчик события замыкается профиль.
   Это осознанный отказ от «оптимизации», см. ADR 026 решение 1.
2. Стартуем от дефолтов библиотеки и **сужаем** их до своих (существующий приём `Replace(...)`
   — перенести как есть): `AllowedTags`, `AllowedAttributes`, `AllowedCssProperties`,
   `AllowedSchemes`, `UriAttributes`.
3. `AllowDataAttributes = false;` `AllowCssCustomProperties = false;`
   `KeepChildNodes` — оставить по умолчанию `false` (запрещённый тег вырезается вместе с
   содержимым — текущее поведение §E.5, не менять).
4. Подписка на **`PostProcessDom`** (§4).
5. `sanitizer.Sanitize(html)` — **без второго аргумента `baseUrl`**. Перегрузка с `baseUrl`
   резолвит относительные URL в абсолютные, а `/uploads/...` обязан доехать до БД
   относительным.

### 3.2. Почему `PostProcessDom`, а не другие хуки

Проверено по XML-докам пакета `HtmlSanitizer 9.2.995`:

- `RemovingStyle`/`RemovingAttribute` срабатывают **только на удалении** — добавить своё
  удаление через них нельзя.
- `SanitizeCssValue(IElement, string, string, out RemoveReason)` не получает **имя свойства**
  — per-property правила на нём не выразить.
- `FilterUrl` подошёл бы для `src`, но потребовал бы второй хук для `width` и третий для CSS.

`PostProcessDom` даёт весь документ один раз, последним шагом перед сериализацией: наш проход —
финальная инстанция, и одним хуком закрываются все три задачи.

---

## 4. Обработчик `PostProcessDom`

Вход: `PostProcessDomEventArgs.Document` (`IHtmlDocument`).

### 4.1. Картинки

```
foreach (var img in document.QuerySelectorAll("img").ToList())
    если !IsAllowedImageSource(img.GetAttribute("src"))  -> img.Remove();
    иначе если img есть атрибут "width" и !IsAllowedImageWidth(...) -> img.RemoveAttribute("width");
```

Итерировать по материализованному списку (`.ToList()`) — модифицируем DOM внутри цикла.

**Невалидный `src` удаляет весь элемент `img`**, а не только атрибут: `<img>` без `src` — это
иконка «битая картинка» в почтовом клиенте, что хуже отсутствия картинки. Невалидный `width`
удаляет **только атрибут**, картинка остаётся (отрисуется в натуральную величину).

### 4.2. Инлайновые стили

```
foreach (var el in document.QuerySelectorAll("[style]").ToList())
    прочитать el.GetAttribute("style")
    разбить по ';'
    для каждого куска: разбить по первому ':' -> (property.Trim().ToLowerInvariant(), value.Trim())
    normalized = NormalizeCssValue(property, value)
    если normalized != null -> добавить "property:normalized" в результат
    если результат пуст -> el.RemoveAttribute("style")
    иначе -> el.SetAttribute("style", string.Join(";", результат))
```

Порядок объявлений сохраняем. Дубли одного свойства — оставляем последнее (как в CSS).
Работаем со строкой атрибута, **не** через `IHtmlElement.Style` / CSSOM: нам нужно, чтобы в
разметку попала ровно наша каноническая строка, а мутация CSSOM отдала бы обратно
нормализованное AngleSharp значение.

### 4.3. `href` на этапе санитизации не трогаем

Поведение ссылок (`a[href]`) остаётся ровно текущим — штатный фильтр схем `HtmlSanitizer`.
Относительные `href` чинятся на отправке (§5), а не здесь.

---

## 5. Абсолютизация media-URL при отправке письма

### 5.1. `MediaUrlAbsolutizer`

```csharp
public static partial class MediaUrlAbsolutizer
{
    /// <summary>Есть ли в разметке src/href, начинающийся с одиночного '/'.</summary>
    public static bool ContainsRelativeUrl(string html);

    /// <summary>Префиксует baseUrl к значениям src/href, начинающимся с одиночного '/'.
    /// Значения с http(s):// и protocol-relative '//' не трогает. baseUrl — origin без хвостового '/'.</summary>
    public static string Absolutize(string html, string baseUrl);
}
```

Реализация — `[GeneratedRegex]`, шаблон вида `(?<attr>\s(?:src|href)=")/(?!/)`, замена на
`${attr}` + `baseUrl` + `/`. `RegexOptions.IgnoreCase | RegexOptions.CultureInvariant`.

**Почему регулярка, а не AngleSharp.** На этом шаге HTML — наш собственный санитизированный и
сериализованный AngleSharp вывод с предсказуемой формой атрибутов (двойные кавычки). Повторный
parse→serialize заново нормализовал бы `style`, которые мы канонизировали в §4.2. Подробнее —
ADR 026 решение 5.

`baseUrl` перед использованием — `TrimEnd('/')`.

### 5.2. `EmailSettings.PublicMediaBaseUrl`

```csharp
// Origin (scheme + host + port), с которого почтовый клиент заберёт /uploads/... . Хвостового
// слэша нет. Пусто -> абсолютизация не выполняется (см. OrderNotificationService).
public string PublicMediaBaseUrl { get; }
```

Порядок разрешения:

1. `Section[nameof(PublicMediaBaseUrl)]` — если непустой, вернуть `TrimEnd('/')`.
2. Иначе — вывести origin из `VerifyUrlBase`: `Uri.TryCreate(VerifyUrlBase, UriKind.Absolute, out var uri)`
   → `uri.GetLeftPart(UriPartial.Authority)`.
3. Иначе — `string.Empty`.

Логирование здесь **не делать**: `EmailSettings` наследует `ApplicationSettingsBase` и логгера
не имеет. Предупреждение пишет потребитель (§5.4).

### 5.3. Конфигурация

`ATTours.ClientAPI/appsettings.json`, секция `Email` — добавить ключ и **починить протухшие
значения**:

```jsonc
"VerifyUrlBase": "https://haytravel.duckdns.org/verify-email",
"ResetUrlBase": "https://haytravel.duckdns.org/reset-password",
"EmailChangeConfirmUrlBase": "https://haytravel.duckdns.org/confirm-email-change",
"PublicMediaBaseUrl": "https://haytravel.duckdns.org"
```

Там же, секция `Cors`: `"AllowedOrigins": "https://haytravel.duckdns.org"` вместо
netlify/vercel.

> **Это не починка сломанного прода.** Проверено: `docker-compose.yml` перекрывает все четыре
> значения переменными окружения из `.env` (`PUBLIC_BASE_URL`, `CORS_ALLOWED_ORIGINS`), а env в
> ASP.NET Core приоритетнее `appsettings.json` — письма подтверждения в проде работают. Правим
> потому, что мёртвый дефолт вводит в заблуждение и, с появлением фолбэка §5.2, на хосте без
> env-переменных начал бы подставлять netlify-домен в `src` картинок. Env-переменные всё равно
> выигрывают, риск изменения нулевой.

`appsettings.Development.json`, секция `Email`: `"PublicMediaBaseUrl": "http://localhost:5253"`
(бэкенд сам раздаёт `/uploads` через `UseStaticFiles` в dev). Порт сверен с `launchSettings.json`:
`applicationUrl` там — `http://localhost:5253`.

`docker-compose.yml`, сервис `backend`, блок `environment` — добавить рядом с остальными
`Email__*`:

```yaml
      Email__PublicMediaBaseUrl: ${PUBLIC_BASE_URL}
```

Новых значений в `.env` на сервере не появляется — `PUBLIC_BASE_URL` там уже есть
(`docs/server-ops.md`). Ручной настройки от владельца при деплое не требуется.

### 5.4. `OrderNotificationService.SendAsync`

Сейчас (строки ~146–149):

```csharp
var subject = Render(template, template.Subject, values, encodeText: false);
var bodyHtml = Render(template, template.BodyHtml, values, encodeText: true);

return emailSender.SendTransactionalAsync(toEmail, toName, subject, bodyHtml, attachment, cancellationToken);
```

Между рендером и отправкой вставить:

```csharp
var mediaBaseUrl = emailSettings.PublicMediaBaseUrl;

if (!string.IsNullOrEmpty(mediaBaseUrl))
    bodyHtml = MediaUrlAbsolutizer.Absolutize(bodyHtml, mediaBaseUrl);
else if (MediaUrlAbsolutizer.ContainsRelativeUrl(bodyHtml))
    logger.LogWarning(
        "Email template {ActionKey} contains relative URLs, but Email:PublicMediaBaseUrl is not configured " +
        "and could not be derived from Email:VerifyUrlBase; images/links will be broken in the sent email.",
        template.ActionKey);
```

`subject` не трогать — это plaintext.

`emailSettings` и `logger` уже есть в конструкторе, новых зависимостей не добавляется.
Абсолютизация делается **только здесь**: `EmailMessageFactory` (письма auth-флоу) собирает HTML
из кода и сразу с абсолютными ссылками — там менять нечего.

---

## 6. Потолок длины тела шаблона

**Ответ на открытый вопрос спеки 012 §Е: лимита на количество и вес картинок не вводим.**
Обоснование — ADR 026 решение 6 (коротко: клиппинг Gmail считает вес HTML, а `<img>` со ссылкой
стоит ~60 байт; `data:` мы и так запрещаем; автор — единственный владелец, а не публичный
пользователь). Вместо этого закрываем реальную незакрытую дыру — отсутствие потолка у
`nvarchar(max)`.

`EmailTemplateValidationService`:

```csharp
public const int MaxBodyHtmlLength = 65_536;
```

В `ValidateEntitiesAsync`, после существующей проверки на пустое тело:

```csharp
if (entity.BodyHtml.Length > MaxBodyHtmlLength)
    throw new ErrorModelException(GlobalErrorCode.EmailTemplateInvalid, HttpStatusCode.BadRequest,
        $"Email template '{entity.ActionKey}' body exceeds {MaxBodyHtmlLength} characters.");
```

`EmailTemplateUpdateService.SaveAsync` — предпроверка **до** санитизации (защита от разбора
многомегабайтной строки AngleSharp'ом):

```csharp
if (!string.IsNullOrEmpty(bodyHtml) && bodyHtml.Length > EmailTemplateValidationService.MaxBodyHtmlLength * 4)
    throw new ErrorModelException(GlobalErrorCode.EmailTemplateInvalid, HttpStatusCode.BadRequest,
        "Email template body is too large.");
```

Код ошибки — существующий `GlobalErrorCode.EmailTemplateInvalid`, тот же, что уже возвращается
на пустое тело. **Фронт менять не нужно**, путь отображения ошибки в карточке шаблона уже есть.

### 6.1. Итоговый вид `EmailTemplateUpdateService.SaveAsync`

Строки 27–28 заменяются на:

```csharp
var sanitizedSubject = RichHtmlSanitizer.ToPlainText(subject);
var sanitizedBodyHtml = RichHtmlSanitizer.Sanitize(bodyHtml, HtmlContentProfile.EmailBody);
```

Порядок «санитизация до валидации» и комментарий, объясняющий его, сохраняются.

---

## 7. Приёмка

### 7.1. Санитизация (`PUT` шаблона → `GET` → сравнить)

| Вход в `bodyHtml` | Ожидаемый результат в БД |
| --- | --- |
| `<p><img src="/uploads/2026/08/a.webp" alt="Схема" width="600"></p>` | Без изменений, путь остался относительным |
| `<img src="https://example.com/a.jpg" alt="">` | Сохранено |
| `<img src="data:image/svg+xml;base64,PHN2Zw==">` | Элемент `img` удалён целиком |
| `<img src="javascript:alert(1)">` | Элемент `img` удалён целиком |
| `<img src="//evil.com/a.png">` | Элемент `img` удалён целиком |
| `<img src="/uploads/../../secret.png">` | Элемент `img` удалён целиком |
| `<img src="/uploads/a.webp" width="99999">` | `width` удалён, `img` и `src` на месте |
| `<img src="/uploads/a.webp" width="600px">` | `width` удалён, `img` и `src` на месте |
| `<img src="/uploads/a.webp" onerror="alert(1)">` | `onerror` удалён, картинка на месте |
| `<img src="/uploads/a.webp" style="width:99px">` | `style` удалён, картинка на месте |
| `<span style="color:#1d4ed8">т</span>` | `color:#1d4ed8` |
| `<span style="color:rgb(29, 77, 216)">т</span>` | `color:#1d4ed8` |
| `<span style="color:#1D4ED8">т</span>` | `color:#1d4ed8` (нижний регистр) |
| `<span style="color:var(--x)">т</span>` | Объявление удалено, текст «т» на месте |
| `<span style="color:red">т</span>` | Числовой цвет (`#ff0000`) **либо** объявление удалено — **оба варианта корректны**, см. ниже |
| `<span style="font-size:16px">т</span>` | Сохранено |
| `<span style="font-size:2000px">т</span>` | Объявление удалено, текст на месте |
| `<span style="font-size:2em">т</span>` | Объявление удалено, текст на месте |
| `<span style="color:#1d4ed8;font-size:18px">т</span>` | Оба объявления сохранены |
| `<span style="margin:0">т</span>` | Объявление удалено (свойства нет в allow-list) |
| `<p style="text-align:center">т</p>` | Сохранено |
| `<script>alert(1)</script>` | Вырезано вместе с содержимым (регрессия) |
| тело длиной > 65 536 символов | `400`, `GlobalErrorCode.EmailTemplateInvalid` |

> **Поправка к таблице §Д спеки 012, строка `color:red`.** Спека 012 ожидала удаления
> объявления. Фактически AngleSharp приводит именованный цвет к числовой форме **до** нашего
> прохода, и мы видим валидный `rgb(255, 0, 0)`. Отличить это от осознанно выбранного
> `#ff0000` невозможно, а с точки зрения безопасности разницы нет. Контракт формулируется как
> **«в БД хранятся только числовые цвета»**; конкретный исход для `red` зависит от версии
> AngleSharp, и оба исхода — проходят. Обоснование — ADR 026 решение 3.

### 7.2. Отправка письма

1. Вставить картинку в шаблон через админку → сохранить → перезагрузить страницу: картинка на
   месте, `src` относительный.
2. Инициировать письмо этого типа → в исходящем HTML `src` абсолютный
   (`https://<origin>/uploads/...`). В dev — проверяется по логу `DevEmailSender`.
3. Внешний `src` (`https://example.com/...`) в письме остался нетронутым.
4. Письмо без картинок отправляется ровно как раньше (регрессия §E.4/E.5, плейсхолдеры
   `{{Token}}` рендерятся).
5. Убрать `Email:PublicMediaBaseUrl` и сделать `VerifyUrlBase` непарсимым → письмо с картинкой
   уходит с относительным `src` и с warning в логе, отправка **не падает**.
6. Открыть письмо в реальном клиенте (Gmail web + мобильный): картинка грузится, ширина не
   ломает вёрстку.

### 7.3. Идемпотентность (обязательный пункт, ловит нормализацию AngleSharp)

Сохранить шаблон → прочитать `bodyHtml` → сохранить **его же** без изменений → прочитать снова.
Обе прочитанные строки должны совпасть **побайтово**. Если не совпадают — значит канонизация
§4.2 не доживает до сериализации; в этом случае зафиксировать фактическую форму в отчёте, не
чинить наугад.

### 7.4. Доступность `/uploads` для почтового клиента (проверка, кода не требует)

- `GET https://haytravel.duckdns.org/uploads/<любой существующий файл>` без заголовка
  `Authorization` возвращает `200`. В `nginx-haytravel.conf` `location /uploads/` отдаётся с
  диска мимо .NET и авторизации не требует — проверено по конфигу, нужна фактическая проверка
  `curl`.
- Referer/CORS не требуются: это обычный `<img>` из чужого клиента.

---

## 8. План внедрения и порядок деплоя

1. `ATTours.Service/Html/*` — четыре новых файла.
2. Перевод `EmailTemplateUpdateService` на `RichHtmlSanitizer`, чистка
   `EmailTemplateValidationService` + правило длины.
3. `EmailSettings.PublicMediaBaseUrl`.
4. `OrderNotificationService.SendAsync` + warning.
5. Конфиги: `appsettings.json`, `appsettings.Development.json`, `docker-compose.yml`.
6. Сборка решения + прогон §7.1 и §7.3 локально (dev-провайдер писем логирует HTML целиком —
   этого достаточно для §7.2 пп. 2–5).
7. Деплой бэкенда **до или одновременно с** фронтовой фазой 1 (спека 011 §9). Выкат фронта
   раньше = молчаливая потеря картинок при сохранении.

**Данные не мигрируются.** Существующие шаблоны картинок не содержат; канонизация CSS применится
к ним при первом же следующем сохранении, что безопасно.

---

## 9. Вне скоупа

- Фаза 2 (описания туров): профиль `RichContent` заводится, но **не подключается ни к одному
  вызову**. Ни `TourValidationService`, ни `TourUpdateService`, ни DTO туров не трогаются.
- `POST api/Upload/Image`, `ImageUploadService`, `UploadSettings` и его лимиты — без изменений.
- Уборка «осиротевших» файлов в `/uploads` (загружен, из контента удалён) — отдельная задача,
  существует одинаково для туров и мест.
- API `GET/PUT api/…/EmailTemplate`, DTO, `EmailTemplateInfoModel`, `EmailPlaceholders`,
  `PlaceholderRegex` — без изменений.
- Схема БД, EF-миграции, `ATToursContext` — без изменений.
- Санитизация на рендере: момент санитизации остаётся «на сохранении» (§E.5).
- Любые изменения во фронтенде: код ошибки существующий, формат `src` не меняется.
- Обновление `docs/architecture-role-notifications.md` §E.5 и `CHANGELOG.md` — шаг
  `update-docs` после приёмки, не часть реализации.
