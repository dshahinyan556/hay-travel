namespace ATTours.Common.DTO.Info
{
    // Плоская проекция в граф тура (как TourRegionInfoModel): без вложенного тега —
    // имя/цвет/тип/процент фронт получает одним запросом к TagController, не из каждого тура.
    public class TourTagInfoModel
    {
        public int Id { get; set; }
        public int TagId { get; set; }
    }
}
