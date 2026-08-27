using ATTours.Common.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ATTours.Common.Infrastructure.EntityConfiguration
{
    // Join-сущность с двумя родителями — оба FK конфигурируются здесь (как TourTagConfiguration).
    public class OrderLineEmployeeConfiguration : IEntityTypeConfiguration<OrderLineEmployee>
    {
        public void Configure(EntityTypeBuilder<OrderLineEmployee> builder)
        {
            builder.ToTable(nameof(OrderLineEmployee));

            // Cascade: строку заказа удаляют вместе с назначениями — назначение без строки
            // бессмысленно (та же семантика, что у OrderLine -> Order).
            builder.HasOne(x => x.OrderLine)
                .WithMany(x => x.Employees)
                .HasForeignKey(x => x.OrderLineId)
                .OnDelete(DeleteBehavior.Cascade);

            // Restrict — как было у OrderLine.Employee: сотрудник это обычный User (soft-delete),
            // заказ не должен молча остаться без ссылки на исполнителя.
            builder.HasOne(x => x.Employee)
                .WithMany()
                .HasForeignKey(x => x.EmployeeId)
                .OnDelete(DeleteBehavior.Restrict);

            // Один сотрудник не может быть добавлен на одну строку дважды: повторное
            // назначение — это изменение роли/деталей (upsert), а не вторая строка.
            builder.HasIndex(x => new { x.OrderLineId, x.EmployeeId })
                .IsUnique();

            // Кабинет сотрудника (GetAssignedToMe) фильтрует по исполнителю — индекс переехал
            // сюда с OrderLine.EmployeeId.
            builder.HasIndex(x => x.EmployeeId);

            builder.Property(x => x.NavigatorLink)
                .HasMaxLength(1000);

            // PickupDetails/Comment/CommentEn — без HasMaxLength (nvarchar(max)): свободный
            // текст без осмысленного потолка, как BodyHtml у EmailTemplate.
        }
    }
}
