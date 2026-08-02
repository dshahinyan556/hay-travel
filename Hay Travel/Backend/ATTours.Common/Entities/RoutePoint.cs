using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    [EntityTypeConfiguration(typeof(RoutePointConfiguration))]
    public class RoutePoint : EntityBase
    {
        public int TourDayId { get; set; }
        public int SortOrder { get; set; }
        // Ссылка на каталог Place (3.4). null = свободная запись (текущее поведение до 3.4).
        // При PlaceId != null регион/координаты/фото берутся из каталога, а подпись —
        // own-переводы ?? Place.Translations (резолв в CatalogOverrideResolver, публичный путь 3.5).
        public int? PlaceId { get; set; }
        public Place Place { get; set; }
        public TourDay TourDay { get; set; }
        public HashSet<RoutePointTranslation> Translations { get; set; } = [];
    }
}
