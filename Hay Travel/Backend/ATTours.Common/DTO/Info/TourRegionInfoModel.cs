namespace ATTours.Common.DTO.Info
{
    // Плоская проекция для графа тура: без вложенного региона с переводами —
    // названия регионов фронт получает одним запросом к RegionController, не из каждого тура.
    public class TourRegionInfoModel
    {
        public int Id { get; set; }
        public int RegionId { get; set; }
        public string Slug { get; set; }
        public int SortOrder { get; set; }
    }
}
