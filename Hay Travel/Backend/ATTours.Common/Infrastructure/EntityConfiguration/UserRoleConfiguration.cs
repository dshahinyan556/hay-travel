using ATTours.Common.Entities;
using ATTours.Common.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class UserRoleConfiguration : IEntityTypeConfiguration<UserRole>
    {
        public void Configure(EntityTypeBuilder<UserRole> builder)
        {
            builder.ToTable(nameof(UserRole));

            builder.Property(x => x.Name)
                .IsRequired()
                .HasMaxLength(256);

            // Уникально: по имени админ различает роли в UI, а сервисы отбивают дубль
            // осмысленной ошибкой (RoleNameInvalid) ещё до попадания в БД.
            builder.HasIndex(x => x.Name)
                .IsUnique();

            // Nullable — стабильный идентификатор только для Employee-эндпоинта (UserRole.cs).
            builder.Property(x => x.Type);

            builder.Property(x => x.CanManageAdmins)
                .IsRequired()
                .HasDefaultValue(false);

            // «Войти как пользователь» (spec 014 §2.1). Сидовым ролям не выдаётся никому:
            // SuperAdmin получает право по своему флагу IsSuperAdmin (в обход роли), а
            // любой другой роли его проставляет вручную SuperAdmin из UI.
            builder.Property(x => x.CanImpersonate)
                .IsRequired()
                .HasDefaultValue(false);

            // Restrict — защита §0.4: роль, на которой висят пользователи, не удаляется
            // (сервис отдаёт осмысленную 409 раньше, чем сработает эта защита БД).
            builder.HasMany(x => x.Users)
                .WithOne(x => x.Role)
                .HasForeignKey(x => x.RoleId)
                .OnDelete(DeleteBehavior.Restrict);

            // Cascade корректен для допустимого случая «удаляем роль без пользователей».
            builder.HasMany(x => x.Permissions)
                .WithOne(x => x.Role)
                .HasForeignKey(x => x.RoleId)
                .OnDelete(DeleteBehavior.Cascade);

            // Regular/TourManager/Admin — дефолтные роли, нужны сразу как валидный RoleId для User.
            // Employee (checklist-orders-redesign.txt, Фаза 2/9) — без этой строки роль некому
            // назначить: ChangeRole шлёт RoleId существующей UserRole-строки, а не голый RoleType.
            // Это просто СИД — стартовые данные: имя и матрица любой из четырёх строк
            // редактируются и удаляются из UI точно так же, как у кастомной роли (решение
            // Давида 2026-08-22 — никакой роли, включая «Администратор», не гарантирован
            // неприкосновенный статус). Единственное исключение — CanManageAdmins: он даёт
            // право трогать других носителей этого же флага, и SuperAdmin проставлен ровно
            // одной сидовой строке (Id 3), чтобы поведение сразу после миграции не изменилось.
            builder.HasData(
                new UserRole { Id = 1, Name = "Обычный пользователь", Type = RoleType.Regular, CanManageAdmins = false, CanImpersonate = false },
                new UserRole { Id = 2, Name = "Тур-менеджер", Type = RoleType.TourManager, CanManageAdmins = false, CanImpersonate = false },
                new UserRole { Id = 3, Name = "Администратор", Type = RoleType.Admin, CanManageAdmins = true, CanImpersonate = false },
                new UserRole { Id = 4, Name = "Исполнитель", Type = RoleType.Employee, CanManageAdmins = false, CanImpersonate = false }
            );
        }
    }
}
