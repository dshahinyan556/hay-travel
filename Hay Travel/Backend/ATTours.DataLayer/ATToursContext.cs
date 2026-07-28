using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;

namespace ATTours.DataLayer
{
    public partial class ATToursContext : DbContext
    {
        public ATToursContext(DbContextOptions<ATToursContext> options) : base(options) { }

        public DbSet<Tour> Tours {  get; set; }
        public DbSet<TourDay> TourDays { get; set; }
        public DbSet<TourDetail> TourDetails { get; set; }
        public DbSet<GalleryImage> GalleryImages {  get; set; }
        public DbSet<AdditionalExpense> AdditionalExpenses { get; set; }
        public DbSet<AdditionalExpenseTranslation> AdditionalExpenseTranslations { get; set; }
        public DbSet<TourInfoTranslation> TourInfoTranslations { get; set; }
        public DbSet<TourDayInfoTranslation> TourDayInfoTranslations { get;set; }
        public DbSet<RoutePoint> RoutePoints { get; set; }
        public DbSet<RoutePointTranslation> RoutePointTranslations { get; set; }
        public DbSet<OrganizationalDetail> OrganizationalDetails { get; set; }
        public DbSet<OrganizationalDetailTranslation> OrganizationalDetailTranslations { get; set; }
        public DbSet<Restriction> Restrictions { get; set; }
        public DbSet<RestrictionTranslation> RestrictionTranslations { get; set; }
    }
}
