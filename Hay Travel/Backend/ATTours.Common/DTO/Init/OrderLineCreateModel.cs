using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Init
{
    // Админ добавляет строку в уже существующий заказ (мокап: "+ Добавить строку в грид").
    //
    // Батч «Трансферы + формат» (2026-08-29): те же поля выбора, что и у брони с сайта
    // (слот / формат / класс авто / обратный рейс) — админская строка обязана считаться по
    // тому же правилу и проходить ту же проверку мест, иначе групповой выезд можно было бы
    // перебронировать из админки.
    //
    // Кастомную заявку этим эндпоинтом не создают: у неё нет продукта, а есть маршрут и
    // детали (api/Order/CreateTransferRequest).
    public class OrderLineCreateModel
    {
        public int OrderId { get; set; }
        public int TourId { get; set; }
        public DateOnly TourDate { get; set; }
        public int GuestCount { get; set; }
        public bool RequiresPrepayment { get; set; }
        public decimal PrepaymentAmount { get; set; }

        public TimeOnly? StartTime { get; set; }
        public TourFormat? Format { get; set; }

        public bool IsRoundTrip { get; set; }
        public DateOnly? ReturnDate { get; set; }
        public TimeOnly? ReturnTime { get; set; }

        public int? VehicleClassId { get; set; }
    }
}
