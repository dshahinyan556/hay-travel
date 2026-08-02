using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class SiteSettingConfiguration : IEntityTypeConfiguration<SiteSetting>
    {
        public void Configure(EntityTypeBuilder<SiteSetting> builder)
        {
            builder.ToTable(nameof(SiteSetting));

            builder.Property(x => x.Key)
                .IsRequired()
                .HasMaxLength(128);

            // Идентичность настройки — ключ, а не Id: upsert идёт по нему.
            builder.HasIndex(x => x.Key)
                .IsUnique();

            // Nullable намеренно: незаполненная настройка — валидное состояние, а не ошибка.
            builder.Property(x => x.Value)
                .HasMaxLength(4000);

            builder.HasMany(x => x.Translations)
                .WithOne(x => x.SiteSetting)
                .HasForeignKey(x => x.SiteSettingId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
