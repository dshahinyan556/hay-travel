using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Журнал событий заказа (spec 007 / ADR 020) — read-only лента под админский таб
    // «История». Пишется ПОСЛЕ успешной мутации, вне её транзакции (OrderEventLog), поэтому
    // сбой журнала не откатывает саму операцию — тот же принцип, что у писем IEmailSender.
    //
    // Обратной коллекции Order.Events нет: граф OrderInfo журнал не читает (ADR 020 §4),
    // связь настраивается через WithMany() без навигации — как у Order.User.
    [EntityTypeConfiguration(typeof(OrderEventConfiguration))]
    public class OrderEvent : EntityBase
    {
        public int OrderId { get; set; }
        public Order Order { get; set; }

        public OrderEventType Type { get; set; }

        // Готовая русская строка для админского таба «История». Не переводится
        // (ITranslatableModel НЕ реализуется) — это внутренний лог, а не контент сайта.
        public string Description { get; set; }

        // Кто выполнил. FK на User сознательно НЕ ставится (см. конфиг) — журнал не должен
        // зависеть от жизненного цикла учётки, имя уже денормализовано в ActorFullName.
        public int? ActorUserId { get; set; }

        // Снапшот имени на момент события: пользователь потом может сменить имя,
        // а история обязана показывать то, что было тогда. Null — событие без автора.
        public string ActorFullName { get; set; }

        public DateTime CreatedAtUtc { get; set; }
    }
}
