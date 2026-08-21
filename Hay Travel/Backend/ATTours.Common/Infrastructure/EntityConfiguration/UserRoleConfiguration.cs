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

            builder.Property(x => x.Description)
                .IsRequired()
                .HasMaxLength(256);

            builder.Property(x => x.Type)
                .IsRequired();

            builder.HasMany(x => x.Users)
                .WithOne(x => x.Role)
                .HasForeignKey(x => x.RoleId)
                .OnDelete(DeleteBehavior.Restrict);

            // Regular/TourManager/Admin — дефолтные роли, нужны сразу как валидный RoleId для User.
            // Employee (checklist-orders-redesign.txt, Фаза 2/9) — без этой строки роль некому
            // назначить: ChangeRole шлёт RoleId существующей UserRole-строки, а не голый RoleType.
            builder.HasData(
                new UserRole { Id = 1, Description = "Обычный пользователь", Type = RoleType.Regular },
                new UserRole { Id = 2, Description = "Тур-менеджер", Type = RoleType.TourManager },
                new UserRole { Id = 3, Description = "Администратор", Type = RoleType.Admin },
                new UserRole { Id = 4, Description = "Исполнитель", Type = RoleType.Employee }
            );
        }
    }
}
