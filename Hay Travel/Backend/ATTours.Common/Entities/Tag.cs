using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Мерч-тег на карточке товара (до 3 на тур, максимум 1 типа Discount — TourValidationService).
    // Discount-тег меняет цену на витрине и в бронировании (OrderCreationService.EnrichAsync);
    // остальные типы чисто декоративные.
    [EntityTypeConfiguration(typeof(TagConfiguration))]
    public class Tag : EntityBase
    {
        public TagType Type { get; set; }
        public TagColor Color { get; set; }
        // Обязателен при Type == Discount, запрещён иначе (TagValidationService).
        public decimal? DiscountPercent { get; set; }
        public int SortOrder { get; set; }
        public HashSet<TagTranslation> Translations { get; set; } = [];
        // Inverse — для проверки «в использовании» при удалении и для графа тура.
        public HashSet<TourTag> TourTags { get; set; } = [];
    }
}
