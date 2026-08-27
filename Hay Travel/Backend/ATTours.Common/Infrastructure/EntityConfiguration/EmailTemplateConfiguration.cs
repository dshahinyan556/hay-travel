using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class EmailTemplateConfiguration : IEntityTypeConfiguration<EmailTemplate>
    {
        public void Configure(EntityTypeBuilder<EmailTemplate> builder)
        {
            builder.ToTable(nameof(EmailTemplate));

            // Идентичность шаблона — action-key: upsert идёт по нему, второй строки
            // на то же действие быть не может.
            builder.HasIndex(x => x.ActionKey)
                .IsUnique();

            builder.Property(x => x.Subject)
                .IsRequired()
                .HasMaxLength(300);

            // Без HasMaxLength -> nvarchar(max): HTML тела письма длинный и не имеет
            // осмысленного потолка, который можно было бы задать заранее.
            builder.Property(x => x.BodyHtml)
                .IsRequired();

            // EN-версии без IsRequired: незаполненный перевод — легальное состояние,
            // письмо в этом случае уходит RU-версией.
            builder.Property(x => x.SubjectEn)
                .HasMaxLength(300);

            builder.Property(x => x.BodyHtmlEn);
        }
    }
}
