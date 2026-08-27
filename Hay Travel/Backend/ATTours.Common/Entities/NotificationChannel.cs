using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Включена ли доставка события по этой платформе. Ровно одна строка на пару
    // (EventKey, Platform) — 4 события x 2 платформы = 8 строк, засеяны миграцией.
    //
    // Рубильник переехал сюда из EmailTemplate.IsEnabled: он принадлежит паре
    // «событие × платформа», а не шаблону письма — у Telegram шаблона нет вовсе.
    [EntityTypeConfiguration(typeof(NotificationChannelConfiguration))]
    public class NotificationChannel : EntityBase
    {
        public EmailActionKey EventKey { get; set; }
        public NotificationPlatform Platform { get; set; }
        public bool IsEnabled { get; set; }
    }
}
