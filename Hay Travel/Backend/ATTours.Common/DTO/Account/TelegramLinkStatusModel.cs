namespace ATTours.Common.DTO.Account
{
    // Ответ GET/DELETE api/Account/Telegram. Сам chat id наружу не отдаётся: пользователю
    // он ни о чём не говорит, а в профиле достаточно факта привязки и @username.
    public class TelegramLinkStatusModel
    {
        public bool IsLinked { get; set; }

        // null, если не привязан (или у чата нет @username).
        public string TelegramUsername { get; set; }
    }
}
