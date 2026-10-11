using ATTours.Common.DTO.Init;
using ATTours.Common.Entities;

namespace ATTours.BusinessServices.Services.Shared
{
    // Сборка контактов заказа из тела запроса — общая для чекаута корзины и кастомной
    // заявки. Отдельный хелпер, а не метод одного из сервисов создания: правило одно, а
    // точек создания заказа уже две и будет третья (ручное создание админом).
    public static class OrderContactBuilder
    {
        // Нормализует значения, тримит имена, назначает SortOrder: основной = 0, остальные
        // в порядке, в котором пришли. Порядку из тела запроса не доверяем — от него
        // зависит, кому менеджер позвонит первым.
        //
        // НИЧЕГО не отбивает: все отказы принимает OrderValidationService, чтобы у правила
        // был один владелец. null -> пустой список.
        //
        // Дубли по паре (Type, Value) внутри одного заказа сознательно НЕ отбиваются и НЕ
        // схлопываются: при потолке в 3 контакта это безвредно, а молча менять присланное
        // сервер не должен.
        public static List<OrderContact> Build(IEnumerable<OrderContactCreateModel> requested)
        {
            var source = (requested ?? []).Where(contact => contact is not null).ToList();
            if (source.Count == 0)
                return [];

            // Основной вперёд, остальные в исходном порядке. OrderBy стабилен, поэтому
            // относительный порядок неосновных сохраняется без дополнительного индекса.
            var ordered = source.OrderByDescending(contact => contact.IsPrimary).ToList();

            var sortOrder = 0;
            return [.. ordered.Select(contact => new OrderContact
            {
                Type = contact.Type,
                Value = ContactMethodValidator.Normalize(contact.Type, contact.Value),
                FirstName = contact.FirstName?.Trim(),
                LastName = contact.LastName?.Trim(),
                IsPrimary = contact.IsPrimary,
                SortOrder = sortOrder++
            })];
        }
    }
}
