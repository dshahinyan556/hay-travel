using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Имя точки. Своего Type нет (одно текстовое поле, как у TourNoteTranslation/RoutePointTranslation).
    [EntityTypeConfiguration(typeof(PlaceTranslationConfiguration))]
    public class PlaceTranslation : EntityBase
    {
        public int PlaceId { get; set; }
        public LanguageCode LanguageCode { get; set; }
        public string Value { get; set; }
        public Place Place { get; set; }
    }
}
