using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Один настраиваемый получатель одного события по одной платформе. Единственный источник
    // правды о том, кому уходит письмо: зашитая в код логика (админ/исполнитель/клиент)
    // удалена. Ноль активных строк у события -> письмо не уходит вообще (осознанное
    // поведение, не баг).
    //
    // Одна таблица со всеми source-полями nullable + дискриминатор SourceType, без
    // EF-наследования: вариантов ровно 4, набор закрыт, а TPH/TPT в кодовой базе нет нигде.
    [EntityTypeConfiguration(typeof(NotificationRecipientConfiguration))]
    public class NotificationRecipient : EntityBase
    {
        public EmailActionKey EventKey { get; set; }
        public NotificationPlatform Platform { get; set; }

        public bool IsActive { get; set; }

        // To/Cc/Bcc. Только для Platform.Email; у Telegram всегда null (валидация в
        // NotificationSettingsValidationService).
        public NotificationRecipientType? Type { get; set; }

        // Дискриминатор: ровно одно из полей ниже осмысленно.
        public NotificationRecipientSource SourceType { get; set; }

        // SourceType == User
        public int? UserId { get; set; }
        public User User { get; set; }

        // SourceType == OrderLinked
        public OrderLinkedRecipient? OrderLinkedRole { get; set; }

        // SourceType == CustomEmail
        public string CustomEmail { get; set; }

        // Порядок строк в гриде админки. Не влияет на отправку (кроме дедупликации адресов:
        // при дубле остаётся строка с наименьшим SortOrder).
        public int SortOrder { get; set; }
    }
}
