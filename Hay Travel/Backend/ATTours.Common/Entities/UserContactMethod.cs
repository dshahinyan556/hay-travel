using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Справочник способов связи в профиле пользователя (батч 2026-08-29): клиент один раз
    // заводит «муж, WhatsApp, +374...» и переиспользует его в следующих заказах.
    //
    // К контактам УЖЕ СОЗДАННЫХ заказов отношения не имеет: там лежит снимок значений
    // (OrderContact), FK между таблицами нет — ADR 032 Р1. Поэтому строка удаляется
    // физически, soft-delete здесь не нужен.
    //
    // Обратной коллекции на User нет: справочник всегда читается своим запросом по UserId,
    // графом пользователя — никогда (то же правило, что у Order.UserId).
    [EntityTypeConfiguration(typeof(UserContactMethodConfiguration))]
    public class UserContactMethod : EntityBase
    {
        // Всегда из токена (User.GetUserId()), никогда из тела запроса — иначе эндпоинт
        // позволял бы завести контакт в чужом профиле.
        public int UserId { get; set; }
        public User User { get; set; }

        public ContactMethodType Type { get; set; }

        // Нормализованное значение: номер с ведущим «+», e-mail в нижнем регистре,
        // Telegram — «@username» либо номер. Нормализует ContactMethodValidator.
        public string Value { get; set; }

        // Кому звонить, а не кто владелец аккаунта: жена оформляет заказ, связаться надо
        // с мужем. Имя обязательно — иначе в заказе стоял бы безымянный номер.
        public string FirstName { get; set; }

        // Фамилия НЕОБЯЗАТЕЛЬНА (решение Давида, 2026-08-29): у клиента её может не быть в
        // удобной форме, а для звонка достаточно имени и номера. null — не «неизвестна»,
        // а «не указана», и в интерфейсе она просто не выводится.
        public string LastName { get; set; }

        // Контакт по умолчанию в справочнике — им форма заказа предзаполняется первым.
        // Инвариант «не больше одного на пользователя» держит сервис, а не уникальный
        // индекс (ADR 032 Р4).
        public bool IsPrimary { get; set; }
    }
}
