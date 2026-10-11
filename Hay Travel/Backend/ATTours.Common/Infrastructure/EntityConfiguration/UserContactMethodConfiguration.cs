using ATTours.Common.Constants;
using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class UserContactMethodConfiguration : IEntityTypeConfiguration<UserContactMethod>
    {
        public void Configure(EntityTypeBuilder<UserContactMethod> builder)
        {
            builder.ToTable(nameof(UserContactMethod));

            // Cascade, в отличие от Order -> User: справочник это личные данные владельца,
            // без него он бессмыслен, а «осиротить» им нечего — заказы держат СНИМОК и от
            // этой таблицы не зависят (ADR 032 Р1). WithMany() без навигации: коллекции
            // ContactMethods на User нет.
            builder.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Property(x => x.Value)
                .IsRequired()
                .HasMaxLength(ContactLimits.MaxValueLength);

            builder.Property(x => x.FirstName)
                .IsRequired()
                .HasMaxLength(ContactLimits.MaxNameLength);

            builder.Property(x => x.LastName)
                .HasMaxLength(ContactLimits.MaxNameLength);

            // Единственный сценарий чтения — «весь справочник одного пользователя».
            builder.HasIndex(x => x.UserId);

            // Уникального filtered-индекса по (UserId) WHERE IsPrimary = 1 здесь НЕТ
            // сознательно: смена основного — снятие флага у старого и установка у нового в
            // одном SaveChanges, порядок UPDATE-ов EF не гарантирует (ADR 032 Р4).
        }
    }
}
