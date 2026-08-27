using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class UserPermissionOverrideConfiguration : IEntityTypeConfiguration<UserPermissionOverride>
    {
        public void Configure(EntityTypeBuilder<UserPermissionOverride> builder)
        {
            builder.ToTable(nameof(UserPermissionOverride));

            builder.Property(x => x.ScreenKey)
                .IsRequired()
                .HasMaxLength(100);

            // Nullable: NULL = «наследовать от роли» (ADR 027). Строка без уровня не
            // заводится вовсе — сервис её удаляет.
            builder.Property(x => x.Level);

            builder.HasIndex(x => new { x.UserId, x.ScreenKey })
                .IsUnique();

            // Cascade: физическое удаление пользователя уносит его override. Soft-delete
            // (User.IsDeleted) строки не трогает — это ок, они просто перестают резолвиться.
            builder.HasOne(x => x.User)
                .WithMany(x => x.PermissionOverrides)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
