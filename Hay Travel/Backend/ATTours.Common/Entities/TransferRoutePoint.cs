using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Точка маршрута предопределённого трансфера (батч 2026-08-29). Отдельно от RoutePoint:
    // та висит на дне тура (TourDayId) и умеет ссылаться на каталог Place, а эта висит прямо
    // на продукте и различает роль точки (откуда / стоп / куда).
    //
    // Текст свободный, с подсказками из каталога Place на фронте (SuggestInput), но БЕЗ FK
    // на Place: решение 0.8 — это подсказка, а не строгий выбор из списка.
    [EntityTypeConfiguration(typeof(TransferRoutePointConfiguration))]
    public class TransferRoutePoint : EntityBase
    {
        public int TourId { get; set; }
        public TransferRoutePointKind Kind { get; set; }
        public int SortOrder { get; set; }
        public Tour Tour { get; set; }
        public HashSet<TransferRoutePointTranslation> Translations { get; set; } = [];
    }
}
