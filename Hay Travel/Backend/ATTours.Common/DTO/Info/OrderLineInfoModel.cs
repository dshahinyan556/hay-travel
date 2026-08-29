using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Info
{
    // Одна строка заказа. TourTitle денормализован (как TourTitle раньше был на OrderInfoModel
    // напрямую) — список заказов и деталь заказа не должны тянуть граф тура отдельным запросом.
    //
    // Батч «Трансферы + формат» (2026-08-29): строка перестала быть обязательно «строкой по
    // продукту». У заявки кастомного трансфера TourId == null, LineKind == CustomTransfer, а
    // маршрут и пожелания лежат в CustomTransferDetails.
    public class OrderLineInfoModel
    {
        public int Id { get; set; }

        // Тип строки. Читать его, а не «TourId == null»: отсутствие продукта — следствие
        // типа строки, а не его определение.
        public OrderLineKind LineKind { get; set; }

        // null ровно у строки-заявки (LineKind == CustomTransfer).
        public int? TourId { get; set; }
        // У заявки продукта нет, и сервер подставляет сюда осмысленную подпись
        // («Кастомный трансфер») — иначе письма, PDF и грид печатали бы пустоту или «Тур #0».
        public string TourTitle { get; set; }
        public string TourMainImageUrl { get; set; }

        public DateOnly TourDate { get; set; }
        // Выбранный слот тура/экскурсии либо время подачи трансфера. null — строки, созданные
        // до появления слотов.
        public TimeOnly? StartTime { get; set; }
        // Формат, по которому посчитана строка (снапшот). null у трансфера и у старых строк.
        public TourFormat? Format { get; set; }

        public int GuestCount { get; set; }

        // Обратный рейс трансфера со своей датой и временем; у тура/экскурсии всегда false.
        public bool IsRoundTrip { get; set; }
        public DateOnly? ReturnDate { get; set; }
        public TimeOnly? ReturnTime { get; set; }

        // Класс авто + снапшот названия на момент брони: переименование класса в справочнике
        // не должно менять уже подтверждённую бронь.
        public int? VehicleClassId { get; set; }
        public string VehicleClassNameSnapshot { get; set; }

        // Заполнено ровно у строки-заявки: маршрут, багаж, пожелания, комментарий.
        public CustomTransferDetailsInfoModel CustomTransferDetails { get; set; }

        public bool RequiresPrepayment { get; set; }
        public decimal PrepaymentAmount { get; set; }

        // Базовая цена продукта на момент брони: за бронь целиком (индивидуальный формат),
        // ЗА ЧЕЛОВЕКА (групповой) либо цена выбранного класса авто (трансфер). У заявки 0 —
        // цены у неё нет до тех пор, пока менеджер не проставит LineTotal вручную.
        public decimal PriceSnapshot { get; set; }
        public decimal? DiscountPercent { get; set; }
        public decimal LineTotal { get; set; }

        // Исполнители строки (0..N, редизайн 2026-08-23). Пустой список — строка не назначена.
        // Роль и "детали для выполнения" живут на каждом исполнителе отдельно.
        public List<OrderLineEmployeeInfoModel> Employees { get; set; } = [];

        public List<OrderPaymentInfoModel> Payments { get; set; } = [];
    }
}
