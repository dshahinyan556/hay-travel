using ATTours.BusinessServices.Telegram;
using ATTours.Common.DTO.Telegram;
using ATTours.Common.Settings;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ATTours.ClientAPI.Controllers
{
    // Входящие апдейты HayTravelNotificationsBot (ADR 031). Транспорт — webhook, не polling.
    //
    // [AllowAnonymous]: запрос приходит от серверов Telegram, JWT у него нет и быть не может.
    // Аутентификация вызывающего — общий секрет из setWebhook, который Telegram присылает
    // в заголовке X-Telegram-Bot-Api-Secret-Token.
    //
    // Контроллер тонкий: проверка секрета -> сервис -> Ok(). Вся логика привязки — в
    // ITelegramLinkService.
    [ApiController]
    [Route("api/telegram")]
    [AllowAnonymous]
    public class TelegramWebhookController(ITelegramLinkService linkService, ITelegramSender sender,
        TelegramSettings settings) : Controller
    {
        private const string SecretHeader = "X-Telegram-Bot-Api-Secret-Token";

        [HttpPost]
        [Route("webhook")]
        public async Task<IActionResult> HandleUpdateAsync([FromBody] TelegramUpdateModel update,
            CancellationToken cancellationToken)
        {
            // 404, а не 401: посторонний не должен по коду ответа узнать, что эндпоинт
            // вообще существует. Незаданный на сервере секрет тоже закрывает эндпоинт —
            // иначе ненастроенный инстанс принимал бы чужие апдейты.
            if (string.IsNullOrWhiteSpace(settings.WebhookSecret)
                || !string.Equals(Request.Headers[SecretHeader].ToString(), settings.WebhookSecret, StringComparison.Ordinal))
                return NotFound();

            var result = await linkService.HandleUpdateAsync(update, cancellationToken);

            if (result.ChatId is not null && !string.IsNullOrEmpty(result.ReplyText))
                await sender.SendMessageAsync(result.ChatId.Value, result.ReplyText, cancellationToken);

            // Всегда 200 (кроме проваленного секрета): не-2xx заставляет Telegram ретраить
            // тот же апдейт, а обрабатывать нам в нём уже нечего.
            return Ok();
        }
    }
}
