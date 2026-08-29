namespace ATTours.Common.DTO.Account
{
    // Ответ POST api/Account/Telegram/LinkCode (ADR 031 §4). Code отдаётся отдельно от
    // ссылки, чтобы фронт мог показать его текстом/QR для тех, у кого клик по deep-link
    // не открывает приложение.
    public class TelegramLinkCodeModel
    {
        // https://t.me/HayTravelNotificationsBot?start=<код>
        public string DeepLinkUrl { get; set; }

        // 24 символа base64url (RandomTokenGenerator.CreateDeepLinkCode).
        public string Code { get; set; }

        public DateTime ExpiresAtUtc { get; set; }
    }
}
