using ATTours.Common.Dto.Init;
using ATTours.Common.DTO.Init;

namespace ATTours.Common.DTO.Info
{
    public class TourDayInfoModel 
    {
        public int Id { get; set; }
        public decimal Price { get; set; }
        public List<TranslatableInfoModel> Translations { get; set; }
        public List<GalleryImageInfoModel> GalleryImages { get; set; }
        public List<RoutePointInfoModel> RoutePoints { get; set; }
    }
}
