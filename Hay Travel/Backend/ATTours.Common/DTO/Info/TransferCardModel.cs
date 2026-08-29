namespace ATTours.Common.DTO.Info
{
    // Карточка предопределённого трансфера для публичного списка /transfers (решение 0.15:
    // в общий каталог туров/экскурсий трансферы не попадают, у них своя страница).
    // Отдельно от TourCardModel: карточка трансфера рисует не длительность/регионы/теги,
    // а маршрут и цену «от».
    public class TransferCardModel
    {
        public int Id { get; set; }
        public string MainImageUrl { get; set; }
        // Тур-уровневые переводы одной локали (Title/ShortDescription/Description/Duration),
        // различаются по Type — тот же контракт, что у TourCardModel.
        public List<TranslatableInfoModel> Translations { get; set; }
        // Маршрут по порядку SortOrder: «откуда» -> стопы -> «куда».
        public List<TransferRoutePointInfoModel> RoutePoints { get; set; }
        // Цена «от» = минимальная цена в одну сторону среди классов авто. null, если у
        // трансфера почему-то нет ни одной строки цен (валидация такого не пропускает,
        // но список — публичный путь чтения, он не должен падать на битых данных).
        public decimal? MinOneWayPrice { get; set; }
    }
}
