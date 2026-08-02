using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class PasswordRecoveryConfiguration : IEntityTypeConfiguration<PasswordRecovery>
    {
        public void Configure(EntityTypeBuilder<PasswordRecovery> builder)
        {
            builder.ToTable(nameof(PasswordRecovery));

            builder.Property(x => x.Token)
                .IsRequired()
                .HasMaxLength(256);

            builder.HasIndex(x => x.Token)
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
