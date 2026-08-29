using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Точка маршрута кастомной заявки (батч 2026-08-29). В отличие от TransferRoutePoint —
    // одноязычная: это ровно тот текст, который ввёл клиент, переводить его некому и незачем.
    [EntityTypeConfiguration(typeof(CustomTransferStopConfiguration))]
    public class CustomTransferStop : EntityBase
    {
        public int CustomTransferDetailsId { get; set; }
        public TransferRoutePointKind Kind { get; set; }
        public int SortOrder { get; set; }
        public string Text { get; set; }
        public CustomTransferDetails CustomTransferDetails { get; set; }
    }
}
