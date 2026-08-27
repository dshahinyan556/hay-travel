using System.Text.RegularExpressions;

namespace ATTours.BusinessServices.Html
{
    // Абсолютизация media-URL в момент ОТПРАВКИ письма (ADR 026, решение 5). Хранимый HTML
    // остаётся с относительным "/uploads/...", потому что тот же контент читают админка,
    // письмо и (в фазе 2) публичный сайт — вшитый домен сломался бы при его смене.
    //
    // Регулярка, а не разбор через AngleSharp: на этом шаге HTML — наш собственный,
    // санитизированный и сериализованный AngleSharp вывод с предсказуемой формой атрибутов
    // (двойные кавычки). Повторный parse->serialize заново нормализовал бы те самые style,
    // которые канонизировал RichHtmlSanitizer.
    public static partial class MediaUrlAbsolutizer
    {
        /// <summary>Есть ли в разметке src/href, начинающийся с одиночного '/'.</summary>
        public static bool ContainsRelativeUrl(string html)
            => !string.IsNullOrEmpty(html) && RelativeUrlAttributeRegex().IsMatch(html);

        /// <summary>Префиксует baseUrl к значениям src/href, начинающимся с одиночного '/'.
        /// Значения с http(s):// и protocol-relative '//' не трогает. baseUrl — origin без хвостового '/'.</summary>
        public static string Absolutize(string html, string baseUrl)
        {
            if (string.IsNullOrEmpty(html) || string.IsNullOrWhiteSpace(baseUrl))
                return html;

            var origin = baseUrl.TrimEnd('/');
            if (origin.Length == 0)
                return html;

            // MatchEvaluator, а не строка замены: origin приходит из конфигурации и '$' в нём
            // был бы истолкован как ссылка на группу.
            return RelativeUrlAttributeRegex().Replace(html, match => $"{match.Groups["attr"].Value}{origin}/");
        }

        [GeneratedRegex("(?<attr>\\s(?:src|href)=\")/(?!/)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
        private static partial Regex RelativeUrlAttributeRegex();
    }
}
