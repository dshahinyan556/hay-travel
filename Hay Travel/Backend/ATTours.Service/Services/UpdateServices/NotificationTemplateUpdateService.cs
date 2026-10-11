using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.Html;
using ATTours.BusinessServices.Services.ValidationServices;
using ATTours.Common.DTO.Request;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace ATTours.BusinessServices.Services.UpdateServices
{
    // Создание и правка одной записи библиотеки Notification Templates (2026-08-31) —
    // одним сервисом на оба случая (id == null -> создать), как у NotificationSettings.
    // Санитизация здесь же, а не в generic EntityActionServiceBase: конкретный профиль
    // (Email/Telegram) зависит от Channel записи, это не универсальная механика.
    public class NotificationTemplateUpdateService : RepositoryCoreBase<NotificationTemplate, ATToursContextFactory>
    {
        private readonly CancellationToken cancellationToken;

        public NotificationTemplateUpdateService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public async Task<int> SaveAsync(int? id, NotificationTemplateUpdateModel model)
        {
            await new NotificationTemplateValidationService(model, id, Context, cancellationToken).ValidateAsync();

            NotificationTemplate entity;

            if (id is null)
            {
                entity = new NotificationTemplate();
                await EntityRepository.AddAsync(entity, cancellationToken);
            }
            else
            {
                entity = await EntityRepository.AsQueryable().SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
                          ?? throw new ErrorModelException(GlobalErrorCode.NotificationTemplateNotFound, HttpStatusCode.NotFound,
                              $"Notification template {id} not found.");
            }

            Apply(entity, model);

            await EntityRepository.SaveChangesAsync(cancellationToken);
            return entity.Id;
        }

        private static void Apply(NotificationTemplate entity, NotificationTemplateUpdateModel model)
        {
            entity.Name = model.Name.Trim();
            entity.Description = string.IsNullOrWhiteSpace(model.Description) ? null : model.Description.Trim();
            entity.Channel = model.Channel;
            entity.BoundEntity = model.BoundEntity;
            entity.Trigger = model.Trigger;
            entity.IsActive = model.IsActive;

            var isEmail = model.Channel == NotificationPlatform.Email;
            var profile = isEmail ? HtmlContentProfile.EmailBody : HtmlContentProfile.TelegramBody;

            // Тема — только у Email; у Telegram поле остаётся null независимо от того, что
            // прислал клиент (валидация это уже проверила, здесь просто не даём просочиться).
            entity.Subject = isEmail ? RichHtmlSanitizer.ToPlainText(model.Subject) : null;
            entity.SubjectEn = isEmail && !string.IsNullOrWhiteSpace(model.SubjectEn)
                ? RichHtmlSanitizer.ToPlainText(model.SubjectEn)
                : null;

            entity.BodyHtml = RichHtmlSanitizer.Sanitize(model.BodyHtml, profile);
            entity.BodyHtmlEn = string.IsNullOrWhiteSpace(model.BodyHtmlEn)
                ? null
                : RichHtmlSanitizer.Sanitize(model.BodyHtmlEn, profile);

            // Кастомный CSS — только Email (решение 2026-08-31: JS не делаем вообще). Текст
            // уже прошёл блокирующую проверку в NotificationTemplateValidationService —
            // здесь только обрезка пробелов, повторно не очищаем.
            entity.CustomCss = isEmail && !string.IsNullOrWhiteSpace(model.CustomCss)
                ? model.CustomCss.Trim()
                : null;
        }
    }
}
