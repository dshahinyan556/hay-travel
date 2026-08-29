using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Init
{
    // Точка маршрута кастомной заявки в теле запроса. Одно поле текста и никаких переводов:
    // это ровно то, что ввёл клиент в конструкторе (в отличие от TransferRoutePointCreateModel
    // у предопределённого трансфера, где точку заводит админ на двух языках).
    public class CustomTransferStopCreateModel
    {
        public TransferRoutePointKind Kind { get; set; }
        // Порядок промежуточных точек (drag-n-drop на фронте). У From/To значения нет.
        public int SortOrder { get; set; }
        public string Text { get; set; }
    }
}
