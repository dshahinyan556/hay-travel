using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Каталог географических точек (3.4). Единственный источник географии точки маршрута:
    // регион/координаты/фото живут только здесь и на уровне тура не переопределяются
    // (решение 3.2 «второй источник географии заводить нельзя», D-8). У RoutePoint при
    // PlaceId != null переопределяется только текстовая подпись — через own-переводы.
    [EntityTypeConfiguration(typeof(PlaceConfiguration))]
    public class Place : EntityBase
    {
        // Внешне-адресуемый стабильный ключ (как Region.Slug): дедуп-гард, ссылка с карты.
        public string Slug { get; set; }
        public int RegionId { get; set; }
        public decimal? Latitude { get; set; }
        public decimal? Longitude { get; set; }
        public string ImageUrl { get; set; }
        public int SortOrder { get; set; }
        public Region Region { get; set; }
        public HashSet<PlaceTranslation> Translations { get; set; } = [];
        // Inverse — для конфигурации FK (Restrict) и проверки «в использовании» при удалении.
        public HashSet<RoutePoint> RoutePoints { get; set; } = [];
    }
}
