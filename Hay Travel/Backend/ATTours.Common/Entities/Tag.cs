using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Мерч-тег на карточке товара (до 3 на тур — TourValidationService). Чисто декоративный;
    // скидка тура больше не тег (Фаза 3, checklist-orders-redesign.txt) — см. Tour.DiscountPercent.
    [EntityTypeConfiguration(typeof(TagConfiguration))]
    public class Tag : EntityBase
    {
        public TagType Type { get; set; }
        public TagColor Color { get; set; }
        public int SortOrder { get; set; }
        public HashSet<TagTranslation> Translations { get; set; } = [];
        // Inverse — для проверки «в использовании» при удалении и для графа тура.
        public HashSet<TourTag> TourTags { get; set; } = [];
    }
}
