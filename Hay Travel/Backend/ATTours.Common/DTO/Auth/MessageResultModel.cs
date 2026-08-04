namespace ATTours.Common.DTO.Auth
{
    // Generic-ответ сценариев «мы что-то отправили на почту». Текст одинаков независимо
    // от того, существует аккаунт или нет — иначе по ответу перебирались бы адреса.
    public class MessageResultModel
    {
        public string Message { get; set; }

        // Заполняется только DevEmailSender'ом (локальная разработка без почтового провайдера):
        // письмо никуда не уходит, поэтому токен возвращается прямо в ответе.
        // В конфигурации с настроенным SendGrid всегда null.
        public string DevToken { get; set; }
    }
}
