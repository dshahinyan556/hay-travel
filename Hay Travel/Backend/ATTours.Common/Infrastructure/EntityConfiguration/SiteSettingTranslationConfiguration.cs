using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class SiteSettingTranslationConfiguration : IEntityTypeConfiguration<SiteSettingTranslation>
    {
        public void Configure(EntityTypeBuilder<SiteSettingTranslation> builder)
        {
            builder.ToTable(nameof(SiteSettingTranslation));

            // Nullable, как и Value самой настройки: пустой перевод — валидное состояние.
            builder.Property(x => x.Value)
                .HasMaxLength(4000);
        }
    }
}
