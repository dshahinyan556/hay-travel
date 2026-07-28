using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    [EntityTypeConfiguration(typeof(TourConfiguration))]
    public class Tour : EntityBase
    {
        public TourType Type { get; set; }
        public decimal? TotalPrice { get; set; }
        public bool IsActive { get; set; }
        // Мягкое удаление: архивный тур скрыт из основного списка, но восстановим.
        // Отдельно от IsActive (публикация на сайте) — это разные состояния.
        public bool IsArchived { get; set; }
        public string MainImageUrl { get; set; }
        public HashSet<TourDetail> TourDetails { get; set; } = [];
        public HashSet<TourInfoTranslation> Translations { get; set; } = [];
        public HashSet<AdditionalExpense> AdditionalExpenses { get; set; } = [];
        public HashSet<OrganizationalDetail> OrganizationalDetails { get; set; } = [];
        public HashSet<Restriction> Restrictions { get; set; } = [];
    }
}
