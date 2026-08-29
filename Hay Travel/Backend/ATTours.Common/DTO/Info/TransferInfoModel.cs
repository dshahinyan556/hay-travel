namespace ATTours.Common.DTO.Info
{
    // Детальная предопределённого трансфера для публичной страницы /transfers/:id.
    // Осознанно НЕ TourInfoModel: у трансфера нет дней, галереи, регионов, тегов, скидки,
    // орг.деталей и доп.расходов (решение 0.4) — отдавать наружу модель с десятком всегда
    // пустых коллекций значило бы врать о контракте.
    public class TransferInfoModel
    {
        public int Id { get; set; }
        public string MainImageUrl { get; set; }
        // Показывать ли блок предоплаты в форме брони (как у тура, решение 0.10).
        public bool RequiresPrepayment { get; set; }
        public List<TranslatableInfoModel> Translations { get; set; }
        public List<TransferRoutePointInfoModel> RoutePoints { get; set; }
        // Классы авто с обеими ценами и вместимостью/лимитом багажа, по SortOrder класса.
        public List<TransferPriceClientModel> Prices { get; set; }
    }
}
