using ATTours.Common.DTO.Init;

namespace ATTours.Common.Dto.Init
{
    public class RoutePointCreateModel
    {
        public int SortOrder { get; set; }
        // Ссылка на каталог Place (3.4). null = свободная запись без каталога.
        public int? PlaceId { get; set; }
        public List<TranslatableCreateModel> Translations { get; set; }
    }
}
