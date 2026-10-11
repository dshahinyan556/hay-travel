using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Init
{
    // Один контакт для связи в теле создания заказа (батч 2026-08-29). Одинаково приезжает
    // и из чекаута корзины, и из кастомной заявки на трансфер.
    //
    // Ссылки на контакт справочника (UserContactMethodId) здесь НЕТ и быть не должно:
    // в заказ уезжает снимок значений (ADR 032 Р1). Фронт, выбравший сохранённый контакт,
    // просто присылает его поля.
    public class OrderContactCreateModel
    {
        public ContactMethodType Type { get; set; }
        public string Value { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }

        // Ровно у одного контакта заказа должен стоять true. Сервер это ПРОВЕРЯЕТ, а не
        // досчитывает: кому звонить первым — решение клиента, не порядок полей формы.
        public bool IsPrimary { get; set; }
    }
}
