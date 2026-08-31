using ATTours.Common.Entities;
using ATTours.Common.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class NotificationTemplateConfiguration : IEntityTypeConfiguration<NotificationTemplate>
    {
        public void Configure(EntityTypeBuilder<NotificationTemplate> builder)
        {
            builder.ToTable(nameof(NotificationTemplate));

            builder.Property(x => x.Name)
                .IsRequired()
                .HasMaxLength(200);

            builder.Property(x => x.Description)
                .HasMaxLength(1000);

            // Тема — только у Email, но колонка nullable общая: у Telegram всегда null,
            // проверяет это валидация, не схема (то же решение, что было у EmailTemplate).
            builder.Property(x => x.Subject)
                .HasMaxLength(300);

            builder.Property(x => x.SubjectEn)
                .HasMaxLength(300);

            // Без HasMaxLength -> nvarchar(max).
            builder.Property(x => x.BodyHtml);
            builder.Property(x => x.BodyHtmlEn);
            builder.Property(x => x.CustomCss);

            // Открытый CRUD (в отличие от EmailTemplate.ActionKey) — по Name уникальности
            // не требуем: два шаблона могут называться одинаково, идентичность — Id.

            // Не более одного шаблона на один auth-триггер: иначе AuthService не знал бы,
            // какой из двух использовать. Filtered index — None (0) не участвует в
            // уникальности, иначе была бы только одна допустимая "обычная" запись во всей
            // таблице.
            builder.HasIndex(x => x.Trigger)
                .IsUnique()
                .HasFilter($"[{nameof(NotificationTemplate.Trigger)}] <> {(int)NotificationTemplateTrigger.None}");
        }
    }
}
