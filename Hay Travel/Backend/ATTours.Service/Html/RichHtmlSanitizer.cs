using AngleSharp.Dom;
using AngleSharp.Html.Dom;
using Ganss.Xss;
using System.Net;
using System.Text;

namespace ATTours.BusinessServices.Html
{
    // Публичный фасад санитизации rich-контента: единственная дверь в HtmlContentPolicy
    // (ADR 026, решение 1). Статический класс без DI — состояния нет, альтернативных
    // реализаций нет, интерфейс + регистрация были бы церемонией без выгоды (ADR 005).
    //
    // Санитизируем ОДИН раз, на сохранении: в БД лежит уже чистый HTML, и рендер письма его
    // не перечищает (значения плейсхолдеров и так HTML-кодируются, §E.4).
    public static class RichHtmlSanitizer
    {
        private const char DeclarationSeparator = ';';
        private const char PropertyValueSeparator = ':';

        /// <summary>Санитизация rich-контента по профилю. Пустой/пробельный вход -> string.Empty.</summary>
        public static string Sanitize(string html, HtmlContentProfile profile)
        {
            if (string.IsNullOrWhiteSpace(html))
                return string.Empty;

            var sanitizer = CreateSanitizer(HtmlContentPolicy.For(profile));

            // Без второго аргумента baseUrl: перегрузка с baseUrl резолвит относительные URL в
            // абсолютные, а "/uploads/..." обязан доехать до БД относительным — тот же контент
            // отдаётся и письму, и публичному сайту (ADR 026, решение 4).
            return sanitizer.Sanitize(html);
        }

        /// <summary>Снять всю разметку, оставив текст (тема письма). Сущности разворачиваются обратно, результат Trim'ится.</summary>
        public static string ToPlainText(string html)
        {
            if (string.IsNullOrWhiteSpace(html))
                return string.Empty;

            // Тема письма — plaintext: заголовок разметки не несёт. Теги снимаются, текст внутри
            // сохраняется (KeepChildNodes = true), сущности разворачиваются обратно.
            var sanitizer = new HtmlSanitizer();
            Replace(sanitizer.AllowedTags, []);
            Replace(sanitizer.AllowedAttributes, []);
            Replace(sanitizer.AllowedCssProperties, []);
            sanitizer.AllowDataAttributes = false;
            sanitizer.KeepChildNodes = true;

            return WebUtility.HtmlDecode(sanitizer.Sanitize(html)).Trim();
        }

        // Новый инстанс на каждый вызов — осознанный отказ от кеширования в static-поле:
        // библиотека не даёт гарантии потокобезопасности инстанса, а мы вешаем на него
        // обработчик события. Сохранение шаблона случается считанные разы в месяц; гонка в
        // санитайзере — это дыра в безопасности, а не подтормаживание (ADR 026, решение 1).
        private static HtmlSanitizer CreateSanitizer(HtmlContentPolicyEntry policy)
        {
            // Стартуем от дефолтных наборов библиотеки и сужаем их до своих: так новая
            // версия HtmlSanitizer не «разрешит» нам ничего лишнего сама по себе.
            var sanitizer = new HtmlSanitizer();

            Replace(sanitizer.AllowedTags, policy.Tags);
            Replace(sanitizer.AllowedAttributes, policy.Attributes);
            Replace(sanitizer.AllowedCssProperties, policy.CssProperties);
            Replace(sanitizer.AllowedSchemes, policy.Schemes);
            Replace(sanitizer.UriAttributes, policy.UriAttributes);

            // data-* нам не нужны нигде, а через них проще всего протащить полезную нагрузку
            // для чужого JS, если письмо когда-нибудь начнут показывать в вебе. CSS-переменные
            // запрещены явно: --x обошёл бы таблицу значений, а var(--x) читал бы её обратно.
            sanitizer.AllowDataAttributes = false;
            sanitizer.AllowCssCustomProperties = false;

            // KeepChildNodes остаётся дефолтным false: запрещённый тег вырезается вместе с
            // содержимым, как требует §E.5.

            // PostProcessDom, а не RemovingStyle/SanitizeCssValue/FilterUrl: первые два
            // срабатывают только на удалении и не получают имя свойства, а FilterUrl закрыл бы
            // только src. PostProcessDom даёт документ целиком последним шагом перед
            // сериализацией — наш проход финальная инстанция (ADR 026, решение 3).
            sanitizer.PostProcessDom += (_, args) => ApplyValueRules(args.Document);

            return sanitizer;
        }

        private static void ApplyValueRules(IHtmlDocument document)
        {
            ApplyImageRules(document);
            ApplyInlineStyleRules(document);
        }

        private static void ApplyImageRules(IHtmlDocument document)
        {
            // Материализуем список: DOM модифицируется внутри цикла.
            foreach (var image in document.QuerySelectorAll("img").ToList())
            {
                // Невалидный src удаляет весь элемент, а не только атрибут: <img> без src — это
                // иконка «битая картинка» в почтовом клиенте, что хуже отсутствия картинки.
                if (!HtmlContentPolicy.IsAllowedImageSource(image.GetAttribute("src")))
                {
                    image.Remove();
                    continue;
                }

                // Невалидный width удаляет только атрибут: картинка отрисуется в натуральную
                // величину, а не пропадёт.
                var width = image.GetAttribute("width");
                if (width is not null && !HtmlContentPolicy.IsAllowedImageWidth(width))
                    image.RemoveAttribute("width");
            }
        }

        // Работаем со строкой атрибута, а НЕ через IHtmlElement.Style / CSSOM: нам нужно, чтобы
        // в разметку попала ровно наша каноническая строка, а мутация CSSOM отдала бы обратно
        // нормализованное AngleSharp значение.
        private static void ApplyInlineStyleRules(IHtmlDocument document)
        {
            foreach (var element in document.QuerySelectorAll("[style]").ToList())
            {
                var normalized = NormalizeStyleAttribute(element.GetAttribute("style"));

                if (string.IsNullOrEmpty(normalized))
                    element.RemoveAttribute("style");
                else
                    element.SetAttribute("style", normalized);
            }
        }

        private static string NormalizeStyleAttribute(string? style)
        {
            if (string.IsNullOrWhiteSpace(style))
                return string.Empty;

            // Порядок объявлений сохраняем; дубль одного свойства оставляет последнее значение,
            // как и делает CSS.
            var declarations = new List<KeyValuePair<string, string>>();

            foreach (var declaration in style.Split(DeclarationSeparator, StringSplitOptions.RemoveEmptyEntries))
            {
                var separatorIndex = declaration.IndexOf(PropertyValueSeparator);
                if (separatorIndex <= 0)
                    continue;

                var property = declaration[..separatorIndex].Trim().ToLowerInvariant();
                var value = declaration[(separatorIndex + 1)..].Trim();

                var normalizedValue = HtmlContentPolicy.NormalizeCssValue(property, value);
                if (normalizedValue is null)
                    continue;

                var existingIndex = declarations.FindIndex(item => string.Equals(item.Key, property, StringComparison.Ordinal));
                if (existingIndex >= 0)
                    declarations[existingIndex] = new KeyValuePair<string, string>(property, normalizedValue);
                else
                    declarations.Add(new KeyValuePair<string, string>(property, normalizedValue));
            }

            if (declarations.Count == 0)
                return string.Empty;

            var builder = new StringBuilder();

            foreach (var declaration in declarations)
            {
                if (builder.Length > 0)
                    builder.Append(DeclarationSeparator);

                builder.Append(declaration.Key).Append(PropertyValueSeparator).Append(declaration.Value);
            }

            return builder.ToString();
        }

        private static void Replace(ISet<string> target, IReadOnlyList<string> values)
        {
            target.Clear();
            foreach (var value in values)
                target.Add(value);
        }
    }
}
