using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class TourConfiguration : IEntityTypeConfiguration<Tour>
    {
        public void Configure(EntityTypeBuilder<Tour> builder)
        {
            builder.ToTable(nameof(Tour));

            builder.HasMany(x => x.AdditionalExpenses)
                .WithOne(a => a.Tour)
                .HasForeignKey(a => a.TourId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasMany(x => x.Translations)
                .WithOne(a => a.Tour)
                .HasForeignKey(a => a.TourId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasMany(x => x.Notes)
                .WithOne(x => x.Tour)
                .HasForeignKey(x => x.TourId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Property(a => a.TotalPrice)
                .HasPrecision(18, 2);

            builder.Property(a => a.MainImageUrl)
                .IsRequired()
                .HasMaxLength(4000);

            // Default true (B12, 2026-08-13): предоплата и раньше показывалась на каждом туре
            // безусловно (BookingCard), это поле только добавляет возможность её отключить —
            // существующие туры (миграция) должны молча стать "true", не потерять блок.
            // ValueGeneratedNever() специально ПОВЕРХ HasDefaultValue: без него EF Core трактует
            // "значение == default(bool) (false)" как "не задано" и опускает колонку из INSERT,
            // подставляя DB-дефолт (true) — тогда админ, явно выбравший false для НОВОГО тура,
            // молча получил бы true. С ValueGeneratedNever() EF всегда шлёт то, что реально в
            // сущности; DB-дефолт остаётся страховкой только для миграции и внешних INSERT.
            builder.Property(a => a.RequiresPrepayment)
                .HasDefaultValue(true)
                .ValueGeneratedNever();

            builder.HasIndex(t => t.Type);
            builder.HasIndex(t => t.TotalPrice);
            builder.HasIndex(t => t.IsArchived);
            builder.HasIndex(t => t.IsFeatured);
        }
    }
}
