using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Info
{
    // Чтение заказа: и «мои заказы» на публичном сайте, и админский список.
    // Поля пользователя и тура денормализованы (как RegionSlug в PlaceInfoModel), чтобы
    // админский список не тянул отдельными запросами карточку юзера и граф тура.
    public class OrderInfoModel
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string UserEmail { get; set; }
        // FirstName + LastName одной строкой.
        public string UserFullName { get; set; }
        public int TourId { get; set; }
        // Резолвится по языку: в GetMine контроллер оставляет запрошенную локаль,
        // в админском GetAll — русский заголовок (см. MappingProfile).
        public string TourTitle { get; set; }
        public string TourMainImageUrl { get; set; }
        public DateOnly TourDate { get; set; }
        public int GuestCount { get; set; }
        public OrderStatus Status { get; set; }
        public DateTime CreatedAtUtc { get; set; }
        // Null, пока заказ PendingConfirmation.
        public DateTime? ConfirmedAtUtc { get; set; }
        public OrderPaymentInfoModel Payment { get; set; }
    }
}
