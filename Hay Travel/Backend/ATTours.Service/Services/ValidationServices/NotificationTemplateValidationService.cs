using ATTours.BusinessServices.Html;
using ATTours.Common.DTO.Request;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace ATTours.BusinessServices.Services.ValidationServices
{
    // Валидация одной записи библиотеки Notification Templates перед сохранением (2026-08-31).
    // Не EntityValidationContextDependentBase<T> (как у Tag): вход — DTO формы, а не сама
    // сущность (тот же довод, что у NotificationSettingsValidationService).
    internal class NotificationTemplateValidationService
    {
        public const int MaxBodyHtmlLength = 65_536;
        public const int MaxCustomCssLength = 20_000;

        // Блокирующий (не «очищающий») список: CustomCss — не HTML, а текст CSS-правил,
        // и полноценного CSS-парсера/санитайзера в проекте нет (RichHtmlSanitizer работает
        // с DOM и style-АТРИБУТАМИ элементов, а не с текстом целого <style>-блока). Попытка
        // наполовину «почистить» произвольный CSS регэкспами — источник дыр; надёжнее целиком
        // отклонить строку с любым из этих паттернов, чем пытаться вырезать только их.
        private static readonly string[] ForbiddenCustomCssPatterns =
            ["<", ">", "@import", "javascript:", "expression(", "behavior:", "-moz-binding", "url("];

        private readonly NotificationTemplateUpdateModel model;
        private readonly int? id;
        private readonly IApplicationDbContext context;
        private readonly CancellationToken cancellationToken;

        public NotificationTemplateValidationService(NotificationTemplateUpdateModel model, int? id,
            IApplicationDbContext context, CancellationToken cancellationToken = default)
        {
            this.model = model;
            this.id = id;
            this.context = context;
            this.cancellationToken = cancellationToken;
        }

        public async Task ValidateAsync()
        {
            if (model is null)
                throw Invalid("Notification template payload is empty.");

            if (string.IsNullOrWhiteSpace(model.Name))
                throw Invalid("Name is required.");

            if (!Enum.IsDefined(model.Channel))
                throw Invalid($"Notification platform '{(int)model.Channel}' is unknown.");

            if (!Enum.IsDefined(model.BoundEntity))
                throw Invalid($"Bound entity '{(int)model.BoundEntity}' is unknown.");

            if (!Enum.IsDefined(model.Trigger))
                throw Invalid($"Trigger '{(int)model.Trigger}' is unknown.");

            var isEmail = model.Channel == NotificationPlatform.Email;

            // Тема — только у Email (у Telegram нет темы сообщения, поле должно быть пустым).
            if (isEmail && string.IsNullOrWhiteSpace(model.Subject))
                throw Invalid("Email template must have a non-empty subject.");

            // Пустое тело ДО санитизации — очевидная ошибка. После санитизации — тоже: письмо/
            // сообщение из одних вырезанных тегов ушло бы получателю пустым, и админ об этом не
            // узнал бы (ровно так однажды стёрло Telegram-шаблон целиком — <p>, в который TipTap
            // безусловно оборачивает любой текст, не входил в старый allow-list Telegram-профиля;
            // тот баг починен добавлением "p"/"br" в TelegramEntry, эта проверка — вторая линия
            // защиты на случай похожего пробела в будущем).
            if (string.IsNullOrWhiteSpace(model.BodyHtml))
                throw Invalid("Template body cannot be empty.");

            var sanitizedBody = RichHtmlSanitizer.Sanitize(model.BodyHtml,
                isEmail ? HtmlContentProfile.EmailBody : HtmlContentProfile.TelegramBody);

            if (string.IsNullOrWhiteSpace(sanitizedBody))
                throw Invalid("Template body is empty after removing disallowed markup.");

            EnsureLength(model.BodyHtml, MaxBodyHtmlLength, "body");
            EnsureLength(model.BodyHtmlEn, MaxBodyHtmlLength, "EN body");

            if (!isEmail && !string.IsNullOrWhiteSpace(model.CustomCss))
                throw Invalid("Custom CSS is only supported for Email templates.");

            if (!string.IsNullOrWhiteSpace(model.CustomCss))
            {
                EnsureLength(model.CustomCss, MaxCustomCssLength, "custom CSS");
                GuardCustomCss(model.CustomCss);
            }

            // Не более одного шаблона на один auth-триггер (см. NotificationTemplateConfiguration
            // — то же правило продублировано здесь ради понятного 400 вместо сырого конфликта
            // уникального индекса на SaveChanges).
            if (model.Trigger != NotificationTemplateTrigger.None)
            {
                var duplicate = await context.Set<NotificationTemplate>()
                                             .AsNoTracking()
                                             .AnyAsync(x => x.Trigger == model.Trigger && x.Id != (id ?? 0), cancellationToken);

                if (duplicate)
                    throw Invalid($"Trigger '{model.Trigger}' is already assigned to another template.");
            }
        }

        private static void EnsureLength(string? value, int max, string fieldName)
        {
            if (!string.IsNullOrEmpty(value) && value.Length > max)
                throw Invalid($"Notification template {fieldName} exceeds {max} characters.");
        }

        private static void GuardCustomCss(string css)
        {
            foreach (var pattern in ForbiddenCustomCssPatterns)
            {
                if (css.Contains(pattern, StringComparison.OrdinalIgnoreCase))
                    throw Invalid($"Custom CSS contains a forbidden pattern: '{pattern}'.");
            }
        }

        private static ErrorModelException Invalid(string message)
            => new(GlobalErrorCode.NotificationTemplateInvalid, HttpStatusCode.BadRequest, message);
    }
}
