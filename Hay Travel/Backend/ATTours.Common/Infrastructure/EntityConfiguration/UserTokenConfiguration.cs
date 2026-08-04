using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class UserTokenConfiguration : IEntityTypeConfiguration<UserToken>
    {
        public void Configure(EntityTypeBuilder<UserToken> builder)
        {
            builder.ToTable(nameof(UserToken));

            builder.Property(x => x.Type)
                .IsRequired();

            builder.Property(x => x.Token)
                .IsRequired()
                .HasMaxLength(256);

            builder.HasIndex(x => x.Token)
                .IsUnique();

            // Один активный токен на цель: повторный запрос переписывает существующую строку
            // того же Type, а не плодит новые (ADR 006).
            builder.HasIndex(x => new { x.UserId, x.Type })
                .IsUnique();

            builder.Property(x => x.RequestedAtUtc)
                .IsRequired();

            builder.Property(x => x.RequestIp)
                .IsRequired()
                .HasMaxLength(64);

            builder.Property(x => x.UserAgent)
                .HasMaxLength(512);

            builder.Property(x => x.ExpiresAtUtc)
                .IsRequired();
        }
    }
}
