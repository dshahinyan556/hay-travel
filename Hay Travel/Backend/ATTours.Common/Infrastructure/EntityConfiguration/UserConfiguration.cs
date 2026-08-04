using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class UserConfiguration : IEntityTypeConfiguration<User>
    {
        public void Configure(EntityTypeBuilder<User> builder)
        {
            builder.ToTable(nameof(User));

            builder.Property(x => x.FirstName)
                .IsRequired()
                .HasMaxLength(128);

            builder.Property(x => x.LastName)
                .HasMaxLength(128);

            builder.Property(x => x.Username)
                .IsRequired()
                .HasMaxLength(64);

            builder.HasIndex(x => x.Username)
                .IsUnique();

            builder.Property(x => x.Email)
                .IsRequired()
                .HasMaxLength(256);

            builder.HasIndex(x => x.Email)
                .IsUnique();

            builder.Property(x => x.PhoneNumber)
                .IsRequired()
                .HasMaxLength(15);

            builder.Property(x => x.Password)
                .IsRequired()
                .HasMaxLength(256);

            builder.Property(x => x.IsEmailVerified)
                .IsRequired()
                .HasDefaultValue(false);

            builder.Property(x => x.FailedLoginAttempts)
                .IsRequired()
                .HasDefaultValue(0);

            builder.Property(x => x.ForceToChangePass)
                .IsRequired()
                .HasDefaultValue(false);

            builder.HasOne(x => x.Role)
                .WithMany(x => x.Users)
                .HasForeignKey(x => x.RoleId)
                .OnDelete(DeleteBehavior.Restrict);

            // 1:many, но фактически не больше одной строки на UserTokenType — ограничение
            // держит unique-индекс (UserId, Type) в UserTokenConfiguration (ADR 006).
            builder.HasMany(x => x.Tokens)
                .WithOne(x => x.User)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasMany(x => x.RefreshTokens)
                .WithOne(x => x.User)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
