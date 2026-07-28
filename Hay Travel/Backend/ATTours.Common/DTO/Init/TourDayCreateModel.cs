using ATTours.Common.DTO.Init;

namespace ATTours.Common.Dto.Init
{
    public class TourDayCreateModel
    {
        public decimal Price { get; set; }
        public List<TranslatableCreateModel> Translations { get; set; }
        public List<GalleryImageCreateModel> GalleryImages { get; set; }
        public List<RoutePointCreateModel> RoutePoints { get; set; }
    }
}
