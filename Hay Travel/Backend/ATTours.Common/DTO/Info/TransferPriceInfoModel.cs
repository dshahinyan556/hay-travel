namespace ATTours.Common.DTO.Info
{
    // Цена трансфера для одного класса авто. Плоская проекция FK (как TourTagInfoModel):
    // название/вместимость класса админка резолвит одним запросом к api/VehicleClass,
    // публичная страница получает их уже развёрнутыми в TransferPriceClientModel.
    public class TransferPriceInfoModel
    {
        public int Id { get; set; }
        public int VehicleClassId { get; set; }
        public decimal OneWayPrice { get; set; }
        // Отдельное поле, а не OneWayPrice x 2 (решение 0.6).
        public decimal RoundTripPrice { get; set; }
    }
}
