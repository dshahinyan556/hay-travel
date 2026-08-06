namespace ATTours.Common.DTO.Info
{
    public class PlaceInfoModel
    {
        public int Id { get; set; }
        public string Slug { get; set; }
        public int RegionId { get; set; }
        // Денормализовано (плоско, как Slug в TourRegionInfoModel), чтобы админка
        // не тянула регион с переводами.
        public string RegionSlug { get; set; }
        public decimal? Latitude { get; set; }
        public decimal? Longitude { get; set; }
        // Cover/legacy-поле (B10, 2026-08-06) — остаётся рядом с Images, не заменяется им.
        public string ImageUrl { get; set; }
        public int SortOrder { get; set; }
        public List<TranslatableInfoModel> Translations { get; set; }
        // Множественные фото (B10, 2026-08-06). Reconcile при Update — по Id (add/update/remove),
        // тем же приёмом, что TourUpdateService делает для GalleryImages.
        public List<PlaceImageInfoModel> Images { get; set; }
    }
}
