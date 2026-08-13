using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    public class ClosureRuleConfiguration : IEntityTypeConfiguration<ClosureRule>
    {
        public void Configure(EntityTypeBuilder<ClosureRule> builder)
        {
            builder.ToTable(nameof(ClosureRule));

            // FK nullable -> удаление тура снимает его собственные правила каскадом,
            // а глобальные (TourId == null) не трогаются вовсе.
            // WithMany() без навигации: Tour.ClosureRules не заводим (граф тура их не читает).
            builder.HasOne(x => x.Tour)
                .WithMany()
                .HasForeignKey(x => x.TourId)
                .OnDelete(DeleteBehavior.Cascade);

            // Внутренняя админ-заметка, не перевод — обычная nullable-строка.
            builder.Property(x => x.Reason)
                .HasMaxLength(500);

            // Резолвер грузит правила либо по области (глобальные + тур), либо по типу/дате
            // в пределах месяца — под эти три пути и индексы.
            builder.HasIndex(x => new { x.TourId, x.Type });
            builder.HasIndex(x => x.Date);
            builder.HasIndex(x => x.DayOfWeek);
        }
    }
}
