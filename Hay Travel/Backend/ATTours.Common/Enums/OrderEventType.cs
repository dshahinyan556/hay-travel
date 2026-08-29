namespace ATTours.Common.Enums
{
    // Тип записи в журнале заказа (spec 007). Едет наружу числом: фронт выбирает по нему
    // иконку/цвет события и не должен парсить готовый текст Description.
    public enum OrderEventType
    {
        Created = 1,
        StatusChanged = 2,
        // Правка брони владельцем/админом (дата/гости) — Order.Update, не правка строки.
        Updated = 3,
        LineAdded = 4,
        LineRemoved = 5,
        LineUpdated = 6,
        EmployeeAssigned = 7,
        SentToClient = 8,
        PaymentAdded = 9,
        // Снятие исполнителя со строки/всех строк заказа (Задача D).
        EmployeeUnassigned = 10,
        // Заказ отменён фоновой задачей, а не человеком (OrderAutoCancellationJob).
        // Отдельный тип, а не StatusChanged: в истории заказа должно быть видно, что автора
        // у этого действия нет — иначе «Отклонён» без актора выглядит как потерянный автор.
        AutoCancelled = 11
    }
}
