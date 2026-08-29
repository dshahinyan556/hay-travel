namespace ATTours.Common.DTO.Info
{
    // Одно из предопределённых времён начала продукта (батч 2026-08-29). Клиент на сайте
    // выбирает время только из этого списка, свободный ввод не предусмотрен.
    public class TourStartTimeInfoModel
    {
        public int Id { get; set; }
        // Сериализуется как "HH:mm:ss" (System.Text.Json, TimeOnly) — то же решение, что у
        // DateOnly в полях скидки.
        public TimeOnly Time { get; set; }
        public int SortOrder { get; set; }
    }
}
