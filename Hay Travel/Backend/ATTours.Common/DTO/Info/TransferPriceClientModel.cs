namespace ATTours.Common.DTO.Info
{
    // Публичная строка «класс авто -> две цены»: в отличие от админской TransferPriceInfoModel
    // класс развёрнут прямо здесь (название одной локали, вместимость, лимит багажа) — на
    // публичной странице трансфера этот блок и есть таблица выбора, второй запрос к
    // справочнику ради названий там не нужен.
    public class TransferPriceClientModel
    {
        public int VehicleClassId { get; set; }
        public string VehicleClassName { get; set; }
        public int Capacity { get; set; }
        public int LuggageCapacity { get; set; }
        public int SortOrder { get; set; }
        public decimal OneWayPrice { get; set; }
        public decimal RoundTripPrice { get; set; }
    }
}
