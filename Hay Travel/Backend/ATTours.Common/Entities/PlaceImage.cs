using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Множественные фото точки (B10, 2026-08-06), по образцу GalleryImage (день ~ место).
    // Place.ImageUrl остаётся отдельно как cover/legacy-поле (см. комментарий в Place.cs) —
    // эта таблица его не заменяет, только дополняет.
    [EntityTypeConfiguration(typeof(PlaceImageConfiguration))]
    public class PlaceImage : EntityBase
    {
        public int PlaceId { get; set; }
        public string Url { get; set; }
        public int SortOrder { get; set; }
        public Place Place { get; set; }
    }
}
