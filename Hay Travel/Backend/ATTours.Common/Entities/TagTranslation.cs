using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Название тега — показывается на карточке ровно как ввёл админ, без изменений.
    // Скидка больше не тег (Фаза 3, checklist-orders-redesign.txt) — см. Tour.DiscountPercent.
    [EntityTypeConfiguration(typeof(TagTranslationConfiguration))]
    public class TagTranslation : EntityBase
    {
        public int TagId { get; set; }
        public LanguageCode LanguageCode { get; set; }
        public string Value { get; set; }
        public Tag Tag { get; set; }
    }
}
