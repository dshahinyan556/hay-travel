using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace ATTours.Common.Infrastructure.Conversions
{
    // Every DateTime/DateTime? column in this schema is UTC by convention (the "…AtUtc" naming,
    // SYSUTCDATETIME() defaults) but SQL Server's `datetime2` carries no timezone info, so EF Core
    // reads every one of them back with Kind=Unspecified. System.Text.Json serializes an
    // Unspecified DateTime WITHOUT the trailing "Z" — e.g. "2026-08-11T04:35:00", not
    // "...Z" — and `new Date(...)` on a Z-less ISO string parses it as the BROWSER'S LOCAL time,
    // not UTC. A value that is genuinely "just now" in UTC then reads as "N hours ago" client-side,
    // where N is exactly the visitor's UTC offset (Armenia is UTC+4 — this is why the admin "online"
    // badge was stuck at "4 часа назад" for an account that was active seconds earlier: 2026-08-11).
    //
    // Registered globally in `ATToursContext.ConfigureConventions` rather than per-property: this is
    // not a `User`-specific bug, every "…AtUtc" column across the schema has the same Kind problem,
    // and there is no DateOnly/DateTimeOffset column anywhere in `Entities/` this could clash with
    // (verified before adding this).
    public sealed class UtcDateTimeConverter : ValueConverter<DateTime, DateTime>
    {
        public UtcDateTimeConverter()
            : base(
                toProvider => toProvider,
                fromProvider => DateTime.SpecifyKind(fromProvider, DateTimeKind.Utc))
        {
        }
    }

    public sealed class UtcNullableDateTimeConverter : ValueConverter<DateTime?, DateTime?>
    {
        public UtcNullableDateTimeConverter()
            : base(
                toProvider => toProvider,
                fromProvider => fromProvider.HasValue ? DateTime.SpecifyKind(fromProvider.Value, DateTimeKind.Utc) : fromProvider)
        {
        }
    }
}
