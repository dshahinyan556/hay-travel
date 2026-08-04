using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
    {
        public void Configure(EntityTypeBuilder<RefreshToken> builder)
        {
            builder.ToTable(nameof(RefreshToken));

            // SHA-256 в hex — ровно 64 символа; запас до 128 оставлен на смену алгоритма.
            builder.Property(x => x.TokenHash)
                .IsRequired()
                .HasMaxLength(128);

            builder.HasIndex(x => x.TokenHash)
                .IsUnique();

            builder.Property(x => x.ExpiresAtUtc)
                .IsRequired();

            builder.Property(x => x.CreatedAtUtc)
                .IsRequired();

            builder.Property(x => x.CreatedByIp)
                .HasMaxLength(64);

            builder.Property(x => x.ReplacedByTokenHash)
                .HasMaxLength(128);

            // Не unique: у пользователя несколько живых сессий одновременно.
            builder.HasIndex(x => x.UserId);
        }
    }
}
