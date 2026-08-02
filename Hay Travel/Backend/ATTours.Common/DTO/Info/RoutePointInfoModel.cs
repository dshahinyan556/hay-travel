namespace ATTours.Common.DTO.Info
{
    public class RoutePointInfoModel
    {
        public int Id { get; set; }
        public int SortOrder { get; set; }
        // Ссылка на каталог Place (3.4). null = свободная запись без каталога.
        public int? PlaceId { get; set; }
        public List<TranslatableInfoModel> Translations { get; set; }
    }
}
