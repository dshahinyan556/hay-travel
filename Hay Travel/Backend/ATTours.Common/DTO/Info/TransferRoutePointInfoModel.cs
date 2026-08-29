using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Info
{
    // Точка маршрута предопределённого трансфера. Отдельно от RoutePointInfoModel: та висит
    // на дне тура и умеет ссылаться на каталог Place, а эта висит на самом продукте и несёт
    // роль точки (откуда / стоп / куда). Ссылки на Place нет намеренно (решение 0.8) —
    // каталог тут только источник подсказок на фронте.
    public class TransferRoutePointInfoModel
    {
        public int Id { get; set; }
        public TransferRoutePointKind Kind { get; set; }
        public int SortOrder { get; set; }
        public List<TranslatableInfoModel> Translations { get; set; }
    }
}
