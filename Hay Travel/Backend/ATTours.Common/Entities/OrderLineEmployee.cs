using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Назначение конкретного сотрудника на конкретную строку заказа (редизайн 2026-08-23).
    // Заменяет плоские OrderLine.EmployeeId/EmployeeRole/PickupDetails/NavigatorLink: на одной
    // строке может работать несколько человек одновременно (водитель + гид — валидный случай),
    // и у каждого своя роль и свои "детали для выполнения".
    [EntityTypeConfiguration(typeof(OrderLineEmployeeConfiguration))]
    public class OrderLineEmployee : EntityBase
    {
        public int OrderLineId { get; set; }
        public OrderLine OrderLine { get; set; }

        public int EmployeeId { get; set; }
        public User Employee { get; set; }

        // Non-nullable: назначения без роли не существует (инвариант Задачи D сохраняется,
        // гейт стоит в OrderAssignEmployeeService). Это снапшот на момент назначения, а не
        // FK на User.DefaultJobRole — роль в попапе переопределяется.
        public EmployeeJobRole EmployeeRole { get; set; }

        // "Детали для выполнения" — теперь per-исполнитель, а не per-строка: водитель и гид
        // на одной брони встречают клиента по-разному.
        public string PickupDetails { get; set; }
        public string NavigatorLink { get; set; }

        // Свободный комментарий исполнителю. Две языковые версии — в письмо уходит та, что
        // соответствует PreferredLanguage получателя. Обе nullable: незаполненное поле
        // не появляется ни в письме, ни в PDF.
        public string Comment { get; set; }
        public string CommentEn { get; set; }
    }
}
