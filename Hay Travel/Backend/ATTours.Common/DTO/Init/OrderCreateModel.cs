namespace ATTours.Common.DTO.Init
{
    // Создание брони с корзины (ADR 025): весь чекаут — ОДИН заказ с N строками, даже если
    // в корзине один тур. Атомарно: не проходит хотя бы одна строка — не создаётся ничего.
    //
    // Всё, что определяет деньги, статус и владельца заказа, задаётся на сервере
    // (OrderCreationService) и в теле запроса не принимается: UserId берётся из токена,
    // иначе эндпоинт позволял бы оформить бронь на чужой аккаунт.
    public class OrderCreateModel
    {
        public List<OrderCreateLineModel> Lines { get; set; } = [];

        // Контакты для связи: 1..3, ровно один основной. Пустой список — отказ
        // (OrderContactRequired): менеджер не должен гадать, по какому номеру звонить.
        public List<OrderContactCreateModel> Contacts { get; set; } = [];
    }
}
