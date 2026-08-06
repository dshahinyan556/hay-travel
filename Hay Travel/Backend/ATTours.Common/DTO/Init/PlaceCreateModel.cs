using ATTours.Common.DTO.Init;

// Строчное Dto — как у соседних Create-моделей (TourCreateModel, TourRegionCreateModel).
namespace ATTours.Common.Dto.Init
{
    public class PlaceCreateModel
    {
        public string Slug { get; set; }
        public int RegionId { get; set; }
        public decimal? Latitude { get; set; }
        public decimal? Longitude { get; set; }
        // Cover/legacy-поле (B10, 2026-08-06) — остаётся рядом с Images, не заменяется им.
        public string ImageUrl { get; set; }
        public int SortOrder { get; set; }
        public List<TranslatableCreateModel> Translations { get; set; }
        // Множественные фото (B10, 2026-08-06).
        public List<PlaceImageCreateModel> Images { get; set; }
    }
}
