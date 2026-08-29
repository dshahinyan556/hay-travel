namespace ATTours.Common.DTO.Init
{
    // Кастомная заявка на трансфер, собранная клиентом в конструкторе (решения 0.11-0.14
    // чек-листа checklist-transfers-format-2026-08-29).
    //
    // Отдельная модель, а не OrderCreateModel с особой строкой: у заявки нет продукта, нет
    // цены и нет корзины — она всегда ровно одна позиция и создаёт заказ в статусе Request.
    // Всё, что определяет деньги, статус и владельца, задаёт сервер
    // (CustomTransferRequestCreationService): цена 0, предоплаты нет, UserId из токена.
    public class CustomTransferRequestCreateModel
    {
        // Дата и время подачи машины. Уезжают в OrderLine.TourDate/StartTime — у заявки это
        // тот же «день брони», что и у обычной строки, отдельных полей заводить не нужно.
        public DateOnly PickupDate { get; set; }
        public TimeOnly? PickupTime { get; set; }

        // Обратный рейс со своей датой и временем (решение 0.12), а не «плюс N часов».
        public bool IsRoundTrip { get; set; }
        public DateOnly? ReturnDate { get; set; }
        public TimeOnly? ReturnTime { get; set; }

        // Пассажиров. Уезжает и в OrderLine.GuestCount, и в CustomTransferDetails.PassengerCount:
        // на строке это «за скольких считать», в деталях — «подо что подбирать машину».
        public int PassengerCount { get; set; }

        // Багаж в штуках по типам. Заполнять НЕ обязательно (0/0 — «клиент про багаж ничего
        // не сказал»); если заполнен и выбран класс авто — сверяется с его лимитом
        // (LuggageUnits: средний = 3 единицы, большой = 5).
        public int LuggageMediumCount { get; set; }
        public int LuggageLargeCount { get; set; }
        // Нестандартный багаж свободным текстом (велосипед, лыжи) — в единицы не переводится.
        public string LuggageOther { get; set; }

        // Желаемый класс авто — пожелание, а не бронь класса: итоговую машину и цену
        // согласует менеджер. Может быть не выбран вовсе, в том числе когда пассажиров
        // больше вместимости любого класса (решение 0.14).
        public int? DesiredVehicleClassId { get; set; }

        public string Comment { get; set; }

        // Маршрут: ровно одна точка From, 0..N Stop в порядке SortOrder, ровно одна To.
        // Одноязычный — ровно тот текст, который ввёл клиент.
        public List<CustomTransferStopCreateModel> Stops { get; set; } = [];
    }
}
