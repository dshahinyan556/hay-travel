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
        public DbSet<TourNote> TourNotes { get; set; }
        public DbSet<TourNoteTranslation> TourNoteTranslations { get; set; }
        public DbSet<SiteSetting> SiteSettings { get; set; }
        public DbSet<SiteSettingTranslation> SiteSettingTranslations { get; set; }
        public DbSet<Region> Regions { get; set; }
        public DbSet<RegionTranslation> RegionTranslations { get; set; }
        public DbSet<TourRegion> TourRegions { get; set; }
        public DbSet<Place> Places { get; set; }
        public DbSet<PlaceTranslation> PlaceTranslations { get; set; }
        public DbSet<PlaceImage> PlaceImages { get; set; }
        public DbSet<ExpenseTemplate> ExpenseTemplates { get; set; }
        public DbSet<ExpenseTemplateTranslation> ExpenseTemplateTranslations { get; set; }
        public DbSet<TourNoteTemplate> TourNoteTemplates { get; set; }
        public DbSet<TourNoteTemplateTranslation> TourNoteTemplateTranslations { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<UserRole> UserRoles { get; set; }
        public DbSet<UserToken> UserTokens { get; set; }
        public DbSet<RefreshToken> RefreshTokens { get; set; }
        public DbSet<EmailChangeRequest> EmailChangeRequests { get; set; }
        public DbSet<ExchangeRate> ExchangeRates { get; set; }
    }
}
