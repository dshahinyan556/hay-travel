namespace ATTours.Common.DTO.Auth
{
    // Живая сессия (непогашенный и непросроченный RefreshToken) для управления устройствами
    // (spec 017 §4). Одна и та же форма отдаётся и самому пользователю
    // (GET api/Auth/Sessions), и админке (GET api/Users/{id}/Sessions) — различие только в
    // IsCurrent, который админ вычислить не может и который там всегда false.
    //
    // UserId наружу не едет — тот же принцип, что у LoginHistoryModel: список всегда
    // запрашивается по конкретному пользователю, чей id клиенту уже известен.
    // TokenHash не едет тем более: ручкой отзыва служит Id строки, а не сам секрет.
    public class SessionInfoModel
    {
        public int Id { get; set; }

        public string CreatedByIp { get; set; }
        public string CountryCode { get; set; }
        public string CountryName { get; set; }
        public string City { get; set; }
        public string CreatedByUserAgent { get; set; }

        public DateTime CreatedAtUtc { get; set; }
        public DateTime ExpiresAtUtc { get; set; }

        // Сессия, из которой пришёл сам запрос: определяется сравнением хеша refresh-cookie
        // вызывающего с TokenHash строки. Только для самообслуживания — в админской вьюхе
        // всегда false, потому что админ смотрит чужие сессии.
        public bool IsCurrent { get; set; }
    }
}
