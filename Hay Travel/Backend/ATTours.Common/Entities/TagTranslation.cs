using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Название тега — показывается на карточке ровно как ввёл админ, без изменений.
    // Tag.DiscountPercent НЕ подставляется в этот текст: это чисто серверное поле для расчёта
    // цены со скидкой (OrderCreationService/TourCard), не UI-текст (David, 2026-08-16). Если
    // процент должен быть виден на самом теге — админ вписывает его в название сам
    // (например "Скидка 15%").
    [EntityTypeConfiguration(typeof(TagTranslationConfiguration))]
    public class TagTranslation : EntityBase
    {
        public int TagId { get; set; }
        public LanguageCode LanguageCode { get; set; }
        public string Value { get; set; }
        public Tag Tag { get; set; }
    }
}
