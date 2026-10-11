using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Контакт для связи по КОНКРЕТНОМУ заказу — СНИМОК значений на момент создания
    // (ADR 032 Р1). Правка или удаление контакта в справочнике профиля
    // (UserContactMethod) не должны менять уже оформленный заказ, поэтому FK на справочник
    // здесь СОЗНАТЕЛЬНО отсутствует: тот же принцип, что у OrderLine.PriceSnapshot и
    // VehicleClassNameSnapshot.
    //
    // 1..3 строки на заказ, ровно одна с IsPrimary — правило проверяет
    // OrderValidationService (правило агрегата, а не сервиса создания).
    [EntityTypeConfiguration(typeof(OrderContactConfiguration))]
    public class OrderContact : EntityBase
    {
        public int OrderId { get; set; }
        public Order Order { get; set; }

        public ContactMethodType Type { get; set; }

        // Уже нормализованное значение (ContactMethodValidator) — в БД не попадает то,
        // что прислал клиент «как есть».
        public string Value { get; set; }

        public string FirstName { get; set; }

        // Необязательна, как и в справочнике (решение Давида, 2026-08-29). Правило обязано
        // совпадать с UserContactMethod: иначе сохранённый в профиле контакт нельзя было бы
        // отправить в заказ.
        public string LastName { get; set; }

        // Тот, кому менеджер звонит первым. Ровно один на заказ.
        public bool IsPrimary { get; set; }

        // Порядок показа в карточке заказа, письме и Telegram. Ставит СЕРВЕР (основной = 0,
        // остальные в порядке, в котором пришли), клиентскому значению не доверяем — тот же
        // приём, что у CustomTransferStop.SortOrder.
        public int SortOrder { get; set; }
    }
}
