namespace ATTours.Common.Dto.Init
{
    public class TransferPriceCreateModel
    {
        public int VehicleClassId { get; set; }
        public decimal OneWayPrice { get; set; }
        public decimal RoundTripPrice { get; set; }
    }
}
