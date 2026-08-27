using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class NotificationRecipientConfiguration : IEntityTypeConfiguration<NotificationRecipient>
    {
        public void Configure(EntityTypeBuilder<NotificationRecipient> builder)
        {
            builder.ToTable(nameof(NotificationRecipient));

            // SetNull, а не Cascade/Restrict: удаление (soft-delete) пользователя не должно ни
            // ронять сохранение, ни молча уносить настройку — строка останется, но перестанет
            // резолвиться (резолвер пропускает строки без адреса).
            builder.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.Property(x => x.CustomEmail)
                .HasMaxLength(320);   // RFC-максимум адреса

            // Чтение всегда идёт срезом "событие + платформа".
            builder.HasIndex(x => new { x.EventKey, x.Platform });

            // Уникальных индексов на состав получателей нет сознательно: две строки на одного
            // и того же пользователя с разными Type — вырожденный, но не запрещённый случай,
            // а БД-констрейнт потребовал бы filtered-индексов на каждый вариант дискриминатора.
            // Проверку дублей делает NotificationSettingsValidationService.
        }
    }
}
