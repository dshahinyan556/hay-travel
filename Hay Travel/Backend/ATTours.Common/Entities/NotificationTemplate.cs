using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Библиотека шаблонов уведомлений (экран «Notification Templates», 2026-08-31) —
    // заменяет EmailTemplate (был жёстко привязан 1:1 к EmailActionKey, только Email).
    // Открытый CRUD: админ создаёт/переименовывает/удаляет свои шаблоны сам, набор не
    // закрыт кодом, в отличие от NotificationChannel/NotificationRecipient.
    //
    // Используется двумя разными потребителями через ссылку по Id, а не по ключу:
    //  - NotificationChannel.TemplateId — событие+платформа «Настроек уведомлений»
    //    (Email И Telegram, у обеих теперь есть шаблон — было null у Telegram).
    //  - Trigger — auth-письма (AuthService ищет шаблон по этому полю, см. его доккомент).
    // Шаблон без ни одной ссылки — обычный, ничем не отличается, свободно удаляется.
    [EntityTypeConfiguration(typeof(NotificationTemplateConfiguration))]
    public class NotificationTemplate : EntityBase
    {
        public string Name { get; set; }
        public string Description { get; set; }

        public NotificationPlatform Channel { get; set; }

        // Каталог доступных Data Fields — по этой сущности (EmailPlaceholders.ForEntity).
        // None — фиксированный набор токенов потока (только у Trigger != None).
        public NotificationTemplateEntity BoundEntity { get; set; }

        public NotificationTemplateTrigger Trigger { get; set; }

        public bool IsActive { get; set; }

        // Тема — только у Channel.Email (у Telegram нет темы письма). Plaintext.
        public string Subject { get; set; }
        public string SubjectEn { get; set; }

        // Тело — HTML у обоих каналов, но по разным профилям санитайзера (HtmlContentProfile):
        // EmailBody — полный allow-list; TelegramBody — узкий whitelist самого Telegram
        // (см. HtmlContentPolicy). УЖЕ санитизировано на сохранении, повторно не чистится.
        public string BodyHtml { get; set; }
        public string BodyHtmlEn { get; set; }

        // Только Channel.Email (решение Давида 2026-08-31: JS не делаем вообще, только CSS).
        // Санитизируется отдельно (CSS, не HTML) — см. NotificationTemplateUpdateService.
        public string CustomCss { get; set; }
    }
}
