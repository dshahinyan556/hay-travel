using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Join-сущность тур<->регион со своим Id (замороженное решение) — иначе ReconcileCollection<T>
    // в TourUpdateService (работает только с сущностями, у которых есть свой Id) потребовал бы
    // отдельного ReconcileTourRegions, как это случилось с композитным ключом TourDetail.
    [EntityTypeConfiguration(typeof(TourRegionConfiguration))]
    public class TourRegion : EntityBase
    {
        public int TourId { get; set; }
        public int RegionId { get; set; }
        public int SortOrder { get; set; }
        public Tour Tour { get; set; }
        public Region Region { get; set; }
    }
}
