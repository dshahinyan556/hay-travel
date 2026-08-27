namespace ATTours.Common.Enums
{
    // Закрытый список ролей, привязанных к заказу. Админ сюда НЕ входит: он выбирается
    // обычной строкой-получателем с источником User (решение Давида, 2026-08-23).
    public enum OrderLinkedRecipient
    {
        Client = 1,
        Employee = 2
    }
}
