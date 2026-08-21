using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Join-сущность тур<->тег со своим Id (тот же выбор, что TourRegion — ReconcileCollection<T>
    // в TourUpdateService работает только с сущностями, у которых есть свой Id).
    // Порядка на самой связи нет: отображение сортируется по Tag.Type (Discount первым) и
    // Tag.SortOrder — сквозного per-assignment порядка не нужно.
    [EntityTypeConfiguration(typeof(TourTagConfiguration))]
    public class TourTag : EntityBase
    {
        public int TourId { get; set; }
        public int TagId { get; set; }
        public Tour Tour { get; set; }
        public Tag Tag { get; set; }
    }
}
