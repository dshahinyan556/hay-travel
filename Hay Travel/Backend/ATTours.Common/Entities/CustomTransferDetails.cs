using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Детали кастомного трансфера — заявки, собранной клиентом в конструкторе (батч
    // 2026-08-29, решения 0.11-0.14). Один-к-одному со строкой заказа, у которой
    // LineKind == CustomTransfer и TourId == null; сама заявка — это обычный заказ в статусе
    // OrderStatus.Request с нулевой ценой, отдельной сущности-заявки нет.
    //
    // Дата и время подачи, обратный рейс и число гостей живут на самой OrderLine
    // (TourDate / StartTime / IsRoundTrip / ReturnDate / ReturnTime / GuestCount) — здесь
    // только то, чего у обычной брони не бывает.
    [EntityTypeConfiguration(typeof(CustomTransferDetailsConfiguration))]
    public class CustomTransferDetails : EntityBase
    {
        public int OrderLineId { get; set; }
        public OrderLine OrderLine { get; set; }

        // Пассажиров в заявке. Смысл пересекается с OrderLine.GuestCount, но хранится
        // отдельно: на строке гости — то, за что считают цену (её у заявки ещё нет),
        // а здесь — то, подо что подбирают машину.
        public int PassengerCount { get; set; }

        // Багаж в штуках по типам; в «единицы» переводится по курсу решения 0.13
        // (средний = 3, большой = 5) и сверяется с VehicleClass.LuggageCapacity.
        // Заполнять не обязательно: 0/0 означает «клиент про багаж ничего не сказал».
        public int LuggageMediumCount { get; set; }
        public int LuggageLargeCount { get; set; }
        // Нестандартный багаж свободным текстом (велосипед, лыжи), nullable.
        public string LuggageOther { get; set; }

        // Желаемый класс авто — именно пожелание, а не бронь класса: итоговую машину и цену
        // согласует менеджер. Nullable: клиент может не выбрать ничего, в том числе когда
        // пассажиров больше вместимости любого класса (решение 0.14).
        public int? DesiredVehicleClassId { get; set; }
        public VehicleClass DesiredVehicleClass { get; set; }

        // Свободный комментарий клиента, nullable.
        public string Comment { get; set; }

        // Маршрут заявки: откуда / стопы / куда, в порядке SortOrder.
        public HashSet<CustomTransferStop> Stops { get; set; } = [];
    }
}
