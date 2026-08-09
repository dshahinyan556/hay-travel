namespace ATTours.Common.DTO.Auth
{
    // Строка истории входов (C2, 2026-08-09). Отдаётся только админке
    // (GET api/Users/{id}/LoginHistory) — на публичном /account истории нет по решению Давида.
    //
    // UserId наружу не едет: список всегда запрашивается по конкретному пользователю,
    // и его id клиенту уже известен.
    public class LoginHistoryModel
    {
        public int Id { get; set; }
        public string IpAddress { get; set; }
        public string CountryCode { get; set; }
        public string CountryName { get; set; }
        public string City { get; set; }
        public string UserAgent { get; set; }
        public DateTime LoggedInAtUtc { get; set; }
    }
}
