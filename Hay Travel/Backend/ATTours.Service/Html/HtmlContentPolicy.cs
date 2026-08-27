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

        private const int MinFontSizePx = 1;
        private const int MaxFontSizePx = 96;

        // Объём «Word Light» + картинки: цвет, размер, жирность, выравнивание, ссылки, <img>.
        // Всё остальное (script/style/iframe/object/embed, on*-обработчики, javascript:-ссылки)
        // вырезается вместе с содержимым — это и есть защита от XSS в письме.
        private static readonly HtmlContentPolicyEntry DefaultEntry = new(
            Tags:
            [
                "p", "br", "strong", "b", "em", "i", "u", "s", "span", "a",
                "ul", "ol", "li", "h1", "h2", "h3", "blockquote", "img"
            ],
            // HtmlSanitizer ведёт allow-list атрибутов глобально, не по тегам. href/target/rel
            // на не-<a> и src/alt/width на не-<img> смысла не имеют, а теги, где они могли бы
            // навредить (script, iframe, input), в allow-list не входят и вырезаются целиком —
            // поэтому глобальное разрешение здесь безопасно.
            Attributes: ["href", "target", "rel", "style", "src", "alt", "width"],
            CssProperties: ["color", "font-size", "font-weight", "text-decoration", "text-align"],
            Schemes: ["http", "https", "mailto"],
            UriAttributes: ["href", "src"]);

        private static readonly HashSet<string> FontWeightKeywords =
            new(["normal", "bold"], StringComparer.Ordinal);

        private static readonly HashSet<string> TextDecorationKeywords =
            new(["none", "underline", "line-through"], StringComparer.Ordinal);

        private static readonly HashSet<string> TextAlignKeywords =
            new(["left", "center", "right", "justify"], StringComparer.Ordinal);

        // Оба профиля пока указывают на одну запись (ADR 026, решение 2): различий между
        // «телом письма» и «описанием тура» сегодня нет, дублировать таблицу незачем.
        internal static HtmlContentPolicyEntry For(HtmlContentProfile profile) => profile switch
        {
            HtmlContentProfile.EmailBody => DefaultEntry,
            HtmlContentProfile.RichContent => DefaultEntry,
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
                "font-size" => NormalizeFontSize(trimmed),
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

        private static string? NormalizeFontSize(string value)
        {
            var match = FontSizeRegex().Match(value);
            if (!match.Success)
                return null;

            if (!int.TryParse(match.Groups["size"].Value, NumberStyles.None, CultureInfo.InvariantCulture, out var size))
                return null;

            return size is >= MinFontSizePx and <= MaxFontSizePx
                ? string.Create(CultureInfo.InvariantCulture, $"{size}px")
                : null;
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

        [GeneratedRegex(@"^(?<size>[0-9]{1,3})px$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
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
