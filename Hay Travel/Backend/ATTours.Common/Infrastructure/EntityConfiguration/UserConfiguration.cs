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

            // Filtered (B3, 2026-08-06): удалённый (IsDeleted=1) пользователь не блокирует
            // повторную регистрацию на тот же Username/Email — HasFilter — сырой SQL-предикат,
            // EF Core вставляет его как есть в CREATE UNIQUE INDEX ... WHERE.
            builder.HasIndex(x => x.Username)
                .IsUnique()
                .HasFilter("[IsDeleted] = 0");

            builder.Property(x => x.Email)
                .IsRequired()
                .HasMaxLength(256);

            builder.HasIndex(x => x.Email)
                .IsUnique()
                .HasFilter("[IsDeleted] = 0");

            builder.Property(x => x.PhoneNumber)
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

            // D1 (2026-08-09): дефолт false нужен и для бэкфилла существующих строк —
            // таблица User на момент миграции не пуста. Единственная строка с true
            // проставляется той же миграцией (AddUserIsSuperAdmin), по Username = 'admin'.
            builder.Property(x => x.IsSuperAdmin)
                .IsRequired()
                .HasDefaultValue(false);

            // Soft-delete + activity tracking (B2, 2026-08-06). Таблица User не пустая на
            // момент миграции — see AddUserSoftDeleteAndActivityTracking: IsDeleted/
            // RegisteredAtUtc получают дефолты для бэкфилла существующих строк,
            // RegisteredIp/LastActiveAtUtc/LastLoginIp остаются nullable — для старых строк
            // разумного синтетического значения нет.
            builder.Property(x => x.IsDeleted)
                .IsRequired()
                .HasDefaultValue(false);

            builder.Property(x => x.RegisteredAtUtc)
                .IsRequired()
                .HasDefaultValueSql("SYSUTCDATETIME()");

            builder.Property(x => x.RegisteredIp)
                .HasMaxLength(64);

            builder.Property(x => x.LastActiveAtUtc);

            builder.Property(x => x.LastLoginIp)
                .HasMaxLength(64);

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
