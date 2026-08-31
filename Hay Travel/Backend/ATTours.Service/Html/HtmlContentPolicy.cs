using ATTours.Common.Settings;
using System.Globalization;
using System.Text.RegularExpressions;

namespace ATTours.BusinessServices.Html
{
    // Единственная точка правды о том, что вообще разрешено хранить в rich-контенте (ADR 026,
    // решение 1). Здесь лежат и allow-list'ы имён (теги/атрибуты/CSS-свойства/схемы), и правила
    // значений (src картинки, width, значения CSS) — то, что allow-list по именам не закрывает.
    //
    // Класс internal: наружу из сборки торчит только фасад RichHtmlSanitizer, чтобы «разрешено»
    // нельзя было переопределить из вызывающего кода.
    internal static partial class HtmlContentPolicy
    {
        // Относительный src картинки допускается только внутри публичного каталога загрузок.
        // Префикс берём из UploadSettings, а не хардкодим: и nginx (прод), и UseStaticFiles (dev)
        // раздают ровно этот путь.
        private const string RelativeImagePrefix = UploadSettings.PublicUrlPrefix + "/";

        // Верхняя граница width: 1200 px с запасом перекрывает ширину тела письма (обычно
        // 600-800 px) и при этом не даёт вписать заведомо ломающее вёрстку число.
        private const int MinImageWidth = 1;
        private const int MaxImageWidth = 1200;

        private const decimal MinFontSizePx = 1;
        private const decimal MaxFontSizePx = 96;

        // Курируемый диапазон тулбара — 8-72pt (Notification Templates, 2026-08-31). Верхняя
        // граница чуть выше самого большого пункта списка (72pt) с тем же запасом, что у px.
        private const decimal MinFontSizePt = 1;
        private const decimal MaxFontSizePt = 96;

        // Объём «Word Light» + картинки + таблицы: цвет/заливка/шрифт/размер, жирность,
        // выравнивание, ссылки, <img>, <table>, <pre>/<code>. Всё остальное (script/style/
        // iframe/object/embed, on*-обработчики, javascript:-ссылки) вырезается вместе с
        // содержимым — это и есть защита от XSS в письме.
        //
        // h4-h6, table*, pre, code добавлены вместе с редактором Notification Templates
        // (2026-08-31): раньше редактор их не показывал вовсе, теперь показывает — allow-list
        // расширен ДО включения кнопок в тулбар, иначе сохранённая разметка тихо теряла бы
        // контент (то самое правило из useRichTextEditorInstance.ts на фронте).
        private static readonly HtmlContentPolicyEntry DefaultEntry = new(
            Tags:
            [
                "p", "br", "strong", "b", "em", "i", "u", "s", "span", "a",
                "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "img",
                "table", "thead", "tbody", "tr", "th", "td", "pre", "code"
            ],
            // HtmlSanitizer ведёт allow-list атрибутов глобально, не по тегам. href/target/rel
            // на не-<a> и src/alt/width на не-<img> смысла не имеют, а теги, где они могли бы
            // навредить (script, iframe, input), в allow-list не входят и вырезаются целиком —
            // поэтому глобальное разрешение здесь безопасно.
            Attributes: ["href", "target", "rel", "style", "src", "alt", "width"],
            CssProperties: ["color", "background-color", "font-size", "font-family", "font-weight", "text-decoration", "text-align"],
            Schemes: ["http", "https", "mailto"],
            UriAttributes: ["href", "src"]);

        // Telegram Bot API, parse_mode=HTML: реальный whitelist — b/strong/i/em/u/s/code/pre/a,
        // без атрибутов класса/style/id (https://core.telegram.org/bots/api#html-style).
        // CustomCss/таблицы/картинки/произвольные шрифты сюда не попадают в принципе.
        //
        // "p"/"br" ДОБАВЛЕНЫ сверх реального telegram-whitelist — не для отправки (Telegram их
        // не поддерживает ни в каком виде), а для ХРАНЕНИЯ: TipTap оборачивает КАЖДЫЙ абзац в
        // <p> безусловно (это не отключаемый инструмент тулбара, а сама модель документа), и
        // без "p" в allow-list санитайзер вырезал бы <p> ВМЕСТЕ С СОДЕРЖИМЫМ на каждом
        // сохранении — тело Telegram-шаблона стиралось бы целиком (нашли на живой проверке
        // 2026-08-31/09-01). Перед реальной отправкой в Telegram
        // (OrderNotificationService.Telegram.cs) "p"/"br" конвертируются в '\n' отдельным
        // шагом — Bot API получает то же самое, что ожидал разработчик изначально.
        private static readonly HtmlContentPolicyEntry TelegramEntry = new(
            Tags: ["b", "strong", "i", "em", "u", "s", "code", "pre", "a", "p", "br"],
            Attributes: ["href"],
            CssProperties: [],
            Schemes: ["http", "https"],
            UriAttributes: ["href"]);

        private static readonly HashSet<string> FontWeightKeywords =
            new(["normal", "bold"], StringComparer.Ordinal);

        private static readonly HashSet<string> TextDecorationKeywords =
            new(["none", "underline", "line-through"], StringComparer.Ordinal);

        private static readonly HashSet<string> TextAlignKeywords =
            new(["left", "center", "right", "justify"], StringComparer.Ordinal);

        // Ровно те шрифты, что предлагает Select в тулбаре редактора (web-safe, доживают до
        // email-клиента) — font-family не белый список СИМВОЛОВ, а список ЦЕЛЫХ значений:
        // произвольная строка (даже безобидная на вид) не проходит, только точное совпадение.
        private static readonly HashSet<string> FontFamilyKeywords =
            new(["arial", "georgia", "'times new roman'", "'courier new'", "verdana", "tahoma"],
                StringComparer.Ordinal);

        // RichContent пока указывает на ту же запись, что EmailBody (ADR 026, решение 2):
        // различий между «телом письма» и «описанием тура» сегодня нет, дублировать
        // таблицу незачем. TelegramBody — принципиально другой, узкий список (см. выше).
        internal static HtmlContentPolicyEntry For(HtmlContentProfile profile) => profile switch
        {
            HtmlContentProfile.EmailBody => DefaultEntry,
            HtmlContentProfile.RichContent => DefaultEntry,
            HtmlContentProfile.TelegramBody => TelegramEntry,
            _ => throw new ArgumentOutOfRangeException(nameof(profile), profile, "Unknown HTML content profile.")
        };

        /// <summary>
        /// Допустим ли src картинки: абсолютный http(s) либо путь внутри публичного каталога загрузок.
        /// </summary>
        internal static bool IsAllowedImageSource(string? src)
        {
            if (string.IsNullOrWhiteSpace(src))
                return false;

            // Схема есть — решает она. javascript:, data:, file:, vbscript: отсекаются здесь.
            if (Uri.TryCreate(src, UriKind.Absolute, out var absolute))
                return absolute.Scheme == Uri.UriSchemeHttp || absolute.Scheme == Uri.UriSchemeHttps;

            // Схемы нет: штатный фильтр HtmlSanitizer считает такое значение относительным URL
            // и пропускает как есть — protocol-relative "//evil.com/a.png" и "../../x.png"
            // закрываются только этой проверкой (ADR 026, решение 4).
            if (HasUnsafePathCharacters(src))
                return false;

            return src.StartsWith(RelativeImagePrefix, StringComparison.Ordinal)
                   && src.Length > RelativeImagePrefix.Length;
        }

        /// <summary>
        /// Допустим ли width картинки: целое без единиц и знака в диапазоне 1..1200.
        /// </summary>
        internal static bool IsAllowedImageWidth(string? width)
            => int.TryParse(width, NumberStyles.None, CultureInfo.InvariantCulture, out var value)
               && value is >= MinImageWidth and <= MaxImageWidth;

        /// <summary>Возвращает каноническое значение объявления или null, если объявление надо удалить.</summary>
        internal static string? NormalizeCssValue(string property, string value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return null;

            var trimmed = value.Trim();

            // Ни одно допустимое значение из таблицы ниже не содержит '!' или ';': так одним
            // условием отсекаются "!important" и попытки закрыть объявление внутри значения.
            if (trimmed.Contains('!') || trimmed.Contains(';'))
                return null;

            return property switch
            {
                "color" => NormalizeColor(trimmed),
                "background-color" => NormalizeColor(trimmed),
                "font-size" => NormalizeFontSize(trimmed),
                "font-family" => NormalizeFontFamily(trimmed),
                "font-weight" => NormalizeFontWeight(trimmed),
                "text-decoration" => NormalizeKeyword(trimmed, TextDecorationKeywords),
                "text-align" => NormalizeKeyword(trimmed, TextAlignKeywords),
                // Имени нет в таблице — объявление удаляем. Сюда же попадают var()/calc()/
                // color-mix()/url()/expression()/attr(): ни одно из них не является допустимым
                // значением ни для одного из разрешённых свойств.
                _ => null
            };
        }

        // Принимаем #rgb, #rrggbb, rgb(), rgba() с непрозрачной альфой — храним всегда #rrggbb
        // в нижнем регистре. Канонизация обязательна: AngleSharp внутри HtmlSanitizer
        // пересобирает style из CSSOM и может отдать rgb(29, 77, 216) там, где автор писал
        // #1d4ed8; без приведения к одной форме сохранение шаблона перестало бы быть
        // идемпотентным (ADR 026, решение 3).
        private static string? NormalizeColor(string value)
        {
            var hex = HexColorRegex().Match(value);
            if (hex.Success)
            {
                var digits = hex.Groups["hex"].Value.ToLowerInvariant();

                return digits.Length == 3
                    ? $"#{digits[0]}{digits[0]}{digits[1]}{digits[1]}{digits[2]}{digits[2]}"
                    : $"#{digits}";
            }

            var rgb = RgbColorRegex().Match(value);
            if (!rgb.Success)
                return null;

            // Полупрозрачный цвет в письме — источник сюрпризов на разном фоне у разных клиентов;
            // принимаем только полностью непрозрачную альфу и теряем её при канонизации.
            var alpha = rgb.Groups["a"];
            if (alpha.Success && !OpaqueAlphaRegex().IsMatch(alpha.Value))
                return null;

            if (!TryParseColorComponent(rgb.Groups["r"].Value, out var r)
                || !TryParseColorComponent(rgb.Groups["g"].Value, out var g)
                || !TryParseColorComponent(rgb.Groups["b"].Value, out var b))
                return null;

            return string.Create(CultureInfo.InvariantCulture, $"#{r:x2}{g:x2}{b:x2}");
        }

        // Принимает и px (историческое значение), и pt (курируемый диапазон тулбара
        // 8-72pt, Notification Templates 2026-08-31, десятичные — 10.5pt). Единица
        // сохраняется как есть, не конвертируется: конвертация px<->pt изменила бы визуальный
        // размер уже сохранённых писем.
        private static string? NormalizeFontSize(string value)
        {
            var match = FontSizeRegex().Match(value);
            if (!match.Success)
                return null;

            if (!decimal.TryParse(match.Groups["size"].Value, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var size))
                return null;

            var unit = match.Groups["unit"].Value.ToLowerInvariant();
            var (min, max) = unit == "pt" ? (MinFontSizePt, MaxFontSizePt) : (MinFontSizePx, MaxFontSizePx);

            return size >= min && size <= max
                ? string.Create(CultureInfo.InvariantCulture, $"{size}{unit}")
                : null;
        }

        // Точное совпадение со списком тулбара (без учёта регистра) — предотвращает и
        // произвольные строки, и попытку протащить несколько шрифтов через запятую с
        // подставным первым именем.
        private static string? NormalizeFontFamily(string value)
        {
            var lowered = value.ToLowerInvariant();
            return FontFamilyKeywords.Contains(lowered) ? lowered : null;
        }

        private static string? NormalizeFontWeight(string value)
        {
            var lowered = value.ToLowerInvariant();
            if (FontWeightKeywords.Contains(lowered))
                return lowered;

            if (!int.TryParse(lowered, NumberStyles.None, CultureInfo.InvariantCulture, out var weight))
                return null;

            return weight is >= 100 and <= 900 && weight % 100 == 0
                ? weight.ToString(CultureInfo.InvariantCulture)
                : null;
        }

        private static string? NormalizeKeyword(string value, HashSet<string> keywords)
        {
            var lowered = value.ToLowerInvariant();
            return keywords.Contains(lowered) ? lowered : null;
        }

        private static bool TryParseColorComponent(string value, out int component)
            => int.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture, out component)
               && component is >= 0 and <= 255;

        // Обход каталога, protocol-relative URL, windows-разделитель, управляющие символы и
        // схема, притворяющаяся путём.
        private static bool HasUnsafePathCharacters(string src)
        {
            if (src.Contains("..", StringComparison.Ordinal)
                || src.Contains("//", StringComparison.Ordinal)
                || src.Contains('\\'))
                return true;

            foreach (var character in src)
            {
                if (character < 0x20)
                    return true;

                if (character == '/')
                    break;

                if (character == ':')
                    return true;
            }

            return false;
        }

        [GeneratedRegex(@"^#(?<hex>[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$", RegexOptions.CultureInvariant)]
        private static partial Regex HexColorRegex();

        [GeneratedRegex(@"^rgba?\(\s*(?<r>[0-9]{1,3})\s*,\s*(?<g>[0-9]{1,3})\s*,\s*(?<b>[0-9]{1,3})\s*(?:,\s*(?<a>[^,()\s]+)\s*)?\)$",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
        private static partial Regex RgbColorRegex();

        [GeneratedRegex(@"^(?:1(?:\.0+)?|100%)$", RegexOptions.CultureInvariant)]
        private static partial Regex OpaqueAlphaRegex();

        // Целое или с одним десятичным знаком (10.5pt из курируемого списка тулбара).
        [GeneratedRegex(@"^(?<size>[0-9]{1,3}(?:\.[0-9])?)(?<unit>px|pt)$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
        private static partial Regex FontSizeRegex();
    }

    // Запись политики: набор «что разрешено по именам». Значения проверяются отдельно, в
    // HtmlContentPolicy.
    internal sealed record HtmlContentPolicyEntry(
        IReadOnlyList<string> Tags,
        IReadOnlyList<string> Attributes,
        IReadOnlyList<string> CssProperties,
        IReadOnlyList<string> Schemes,
        IReadOnlyList<string> UriAttributes);
}
