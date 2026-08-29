namespace ATTours.Common.Enums
{
    // Что именно забронировано строкой заказа (батч «Трансферы + формат», 2026-08-29).
    // До появления кастомных трансферов строка всегда ссылалась на Tour — теперь TourId
    // nullable, и различать случаи нужно явным полем, а не «TourId == null».
    public enum OrderLineKind
    {
        // Обычная строка: тур, экскурсия или предопределённый трансфер — всегда с TourId.
        Product = 1,
        // Кастомный трансфер, собранный клиентом в конструкторе: TourId == null, цены нет
        // (заказ создаётся со статусом OrderStatus.Request), детали — в CustomTransferDetails.
        CustomTransfer = 2
    }
}
