using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Шапка заказа (переделка B14, 2026-08-16 — ADR 019 заменяет ADR 014): один заказ теперь
    // может нести НЕСКОЛЬКО строк (OrderLine — тур/дата/гости/деньги/исполнитель на каждой),
    // бронь с сайта по-прежнему создаёт заказ с одной строкой, дополнительные строки — только
    // ручное действие админа. Денежные ПРОВОДКИ (не снапшот) — отдельная сущность OrderPayment,
    // список, привязанный к конкретной строке.
    //
    // Обратных коллекций (Tour.Orders / User.Orders) нет: заказы никогда не читаются
    // графом тура/пользователя, FK-стороны достаточно (как у Place.RegionId).
    [EntityTypeConfiguration(typeof(OrderConfiguration))]
    public class Order : EntityBase
    {
        // Всегда из токена (User.GetUserId()), никогда из тела запроса — иначе создание
        // заказа стало бы способом оформить бронь на чужой аккаунт.
        public int UserId { get; set; }
        public User User { get; set; }

        // "Человеческий" номер: ДДММГГ + 4-значный счётчик, сброс каждый день
        // (OrderNumberGenerator, Фаза 1.4). Отдельно от Id — Id остаётся техническим PK.
        public string Number { get; set; }

        public OrderStatus Status { get; set; }

        // Заполняется только при Status == Rejected, необязательно (Давид, 2026-08-16).
        public string RejectReason { get; set; }

        // Настоящий момент времени, поэтому DateTime (UTC). Ставит OrderCreationService.
        public DateTime CreatedAtUtc { get; set; }

        // Момент перехода в Approved. Null, пока этого не произошло.
        public DateTime? ApprovedAtUtc { get; set; }

        // ISO-4217, вся сумма заказа в одной валюте. Базовая цена на бэке всегда AMD
        // (мультивалютность — отображение на фронте, как и раньше — см. ADR 014).
        public string Currency { get; set; }

        public HashSet<OrderLine> Lines { get; set; } = [];

        // Контакты для связи по этому заказу — 1..3, ровно один основной (батч 2026-08-29).
        // Снимок значений на момент создания, справочник профиля им не владеет (ADR 032).
        public HashSet<OrderContact> Contacts { get; set; } = [];
    }
}
