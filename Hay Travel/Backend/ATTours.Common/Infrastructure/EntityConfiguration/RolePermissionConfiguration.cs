using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class RolePermissionConfiguration : IEntityTypeConfiguration<RolePermission>
    {
        public void Configure(EntityTypeBuilder<RolePermission> builder)
        {
            builder.ToTable(nameof(RolePermission));

            builder.Property(x => x.ScreenKey)
                .IsRequired()
                .HasMaxLength(100);

            // Уровень хранится int'ом (значения AccessLevel), 0 = None: строка без прав
            // эквивалентна отсутствию строки, поэтому дефолт безопасен (ADR 027).
            builder.Property(x => x.Level)
                .IsRequired()
                .HasDefaultValue(Enums.AccessLevel.None);

            // Не больше одной строки на (роль, экран) — резолвер строит словарь по ScreenKey.
            builder.HasIndex(x => new { x.RoleId, x.ScreenKey })
                .IsUnique();

            // FK на UserRole задан со стороны UserRoleConfiguration (Cascade).
            // HasData здесь намеренно нет: матрица правится из UI, а сид системных ролей
            // делает миграция через InsertData — иначе HasData конфликтовал бы с правками
            // (architecture-flexible-roles.md §1.3).
        }
    }
}
