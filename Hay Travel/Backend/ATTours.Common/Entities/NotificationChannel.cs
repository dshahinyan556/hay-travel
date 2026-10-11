using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Включена ли доставка события по этой платформе. Ровно одна строка на пару
    // (EventKey, Platform) — 5 событий x 2 платформы = 10 строк, засеяны миграцией.
    //
    // Рубильник переехал сюда из EmailTemplate.IsEnabled: он принадлежит паре
    // «событие × платформа», а не шаблону письма.
    //
    // TemplateId (Notification Templates, 2026-08-31): ссылка на шаблон из открытой
    // библиотеки вместо инлайн-текста. Раньше шаблон был только у Email (EmailTemplate по
    // ActionKey) и Telegram строил текст кодом (OrderNotificationService.Telegram.cs) —
    // теперь у ОБЕИХ платформ есть шаблон, Telegram-версия просто санитизируется по
    // HtmlContentProfile.TelegramBody (узкий whitelist).
    [EntityTypeConfiguration(typeof(NotificationChannelConfiguration))]
    public class NotificationChannel : EntityBase
    {
        public EmailActionKey EventKey { get; set; }
        public NotificationPlatform Platform { get; set; }
        public bool IsEnabled { get; set; }

        public int? TemplateId { get; set; }
        public NotificationTemplate Template { get; set; }
    }
}
