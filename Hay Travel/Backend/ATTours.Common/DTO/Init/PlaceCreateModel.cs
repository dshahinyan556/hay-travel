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
        public string ImageUrl { get; set; }
        public int SortOrder { get; set; }
        public List<TranslatableCreateModel> Translations { get; set; }
    }
}
