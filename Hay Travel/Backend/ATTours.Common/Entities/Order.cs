using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Бронирование тура на конкретный календарный день.
    // Денежная часть намеренно вынесена в отдельную сущность OrderPayment (1:1, ADR 014):
    // подключение платёжного шлюза будет растить её, а не Order.
    //
    // Обратных коллекций (Tour.Orders / User.Orders) нет: заказы никогда не читаются
    // графом тура/пользователя, FK-стороны достаточно (как у Place.RegionId).
    [EntityTypeConfiguration(typeof(OrderConfiguration))]
    public class Order : EntityBase
    {
        // Всегда из токена (User.GetUserId()), никогда из тела запроса — иначе создание
        // заказа стало бы способом оформить бронь на чужой аккаунт.
        public int UserId { get; set; }
        public User User { get; set; }

        public int TourId { get; set; }
        public Tour Tour { get; set; }

        // Календарный день брони. DateOnly (SQL date), не DateTime: у дня нет часового
        // пояса, и глобальный UtcDateTimeConverter его не касается (ADR 012).
        public DateOnly TourDate { get; set; }

        public int GuestCount { get; set; }

        public OrderStatus Status { get; set; }

        // Настоящий момент времени, поэтому DateTime (UTC). Ставит OrderCreationService.
        public DateTime CreatedAtUtc { get; set; }

        // Null, пока заказ PendingConfirmation. Ставит OrderConfirmationService в момент
        // подтверждения — единственное место, где это происходит.
        public DateTime? ConfirmedAtUtc { get; set; }

        // 1:1, создаётся всегда вместе с заказом в одной транзакции — «заказа без денег»
        // не существует (ADR 014).
        public OrderPayment Payment { get; set; }
    }
}
