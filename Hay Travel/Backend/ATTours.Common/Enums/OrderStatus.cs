namespace ATTours.Common.Enums
{
    // Жизненный цикл заказа. На проводе едет числом, как и прочие enum проекта.
    //
    // Флоу заказов (B12, 2026-08-13): каждая новая бронь стартует в PendingConfirmation
    // и ждёт ручного подтверждения администратором в админке ("Заказы",
    // OrderConfirmationService). Начальный статус выбирается в ОДНОМ месте —
    // OrderCreationService.
    public enum OrderStatus
    {
        // Ждёт ручного подтверждения администратором. Начальный статус любого нового заказа.
        PendingConfirmation = 1,
        // Подтверждён администратором (OrderConfirmationService).
        Confirmed = 2,
        // Отменён. В занятость календаря такие заказы не попадают.
        Cancelled = 3
    }
}
