using ATTours.Common.Entities;
using ATTours.Common.Infrastructure.Conversions;
using Microsoft.EntityFrameworkCore;

namespace ATTours.DataLayer
{
    public partial class ATToursContext : DbContext
    {
        public ATToursContext(DbContextOptions<ATToursContext> options) : base(options) { }

        // Fix for the "online status stuck N hours in the past" class of bug (2026-08-11) — see
        // `UtcDateTimeConverters.cs` for the full mechanism. Applies to every DateTime/DateTime?
        // property in the model, not just User's — every "…AtUtc" column has the same Kind gap.
        protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
        {
            configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
            configurationBuilder.Properties<DateTime?>().HaveConversion<UtcNullableDateTimeConverter>();
        }

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
        public DbSet<Tag> Tags { get; set; }
        public DbSet<TagTranslation> TagTranslations { get; set; }
        public DbSet<TourTag> TourTags { get; set; }
        public DbSet<Place> Places { get; set; }
        public DbSet<PlaceTranslation> PlaceTranslations { get; set; }
        public DbSet<PlaceImage> PlaceImages { get; set; }
        public DbSet<ExpenseTemplate> ExpenseTemplates { get; set; }
        public DbSet<ExpenseTemplateTranslation> ExpenseTemplateTranslations { get; set; }
        public DbSet<TourNoteTemplate> TourNoteTemplates { get; set; }
        public DbSet<TourNoteTemplateTranslation> TourNoteTemplateTranslations { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<UserRole> UserRoles { get; set; }
        public DbSet<RolePermission> RolePermissions { get; set; }
        public DbSet<UserPermissionOverride> UserPermissionOverrides { get; set; }
        public DbSet<UserToken> UserTokens { get; set; }
        public DbSet<RefreshToken> RefreshTokens { get; set; }
        public DbSet<EmailChangeRequest> EmailChangeRequests { get; set; }
        public DbSet<LoginHistory> LoginHistories { get; set; }
        public DbSet<ImpersonationEvent> ImpersonationEvents { get; set; }
        public DbSet<ExchangeRate> ExchangeRates { get; set; }
        public DbSet<Order> Orders { get; set; }
        public DbSet<OrderLine> OrderLines { get; set; }
        public DbSet<OrderLineEmployee> OrderLineEmployees { get; set; }
        public DbSet<OrderPayment> OrderPayments { get; set; }
        public DbSet<OrderEvent> OrderEvents { get; set; }
        public DbSet<ClosureRule> ClosureRules { get; set; }
        public DbSet<EmailTemplate> EmailTemplates { get; set; }
        public DbSet<NotificationChannel> NotificationChannels { get; set; }
        public DbSet<NotificationRecipient> NotificationRecipients { get; set; }
    }
}
