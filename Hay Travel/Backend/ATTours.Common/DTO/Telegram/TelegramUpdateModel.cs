using Newtonsoft.Json;
using System.Text.Json.Serialization;

namespace ATTours.Common.DTO.Telegram
{
    // Минимальный срез входящего апдейта Telegram Bot API (ADR 031 §1): бот send-only,
    // из webhook'а реально нужен только "/start <код>". Полную модель Update (Telegram.Bot)
    // ради трёх полей не тянем.
    //
    // Две пары атрибутов на каждое поле — сознательно: тело запроса биндит Newtonsoft
    // (NewtonSoftJsonConfigurator), а System.Text.Json-атрибут оставлен, чтобы модель
    // оставалась корректной, если сериализатор проекта когда-нибудь сменится.
    //
    // MissingMemberHandling.Ignore на КАЖДОМ типе — обязательно: глобальная настройка
    // проекта Error, а реальный апдейт Telegram несёт десятки полей, которых в этом срезе
    // нет (message_id, date, entities, from.is_bot, chat.type...). Без переопределения
    // биндинг падал бы 400-м, а Telegram ретраил бы тот же апдейт бесконечно.
    // Точечный атрибут, а не смена глобальной настройки: она защищает остальные эндпоинты
    // от опечаток в полях запроса.
    [JsonObject(MissingMemberHandling = MissingMemberHandling.Ignore)]
    public class TelegramUpdateModel
    {
        [JsonProperty("update_id")]
        [JsonPropertyName("update_id")]
        public long UpdateId { get; set; }

        [JsonProperty("message")]
        [JsonPropertyName("message")]
        public TelegramMessageModel Message { get; set; }
    }

    [JsonObject(MissingMemberHandling = MissingMemberHandling.Ignore)]
    public class TelegramMessageModel
    {
        [JsonProperty("text")]
        [JsonPropertyName("text")]
        public string Text { get; set; }

        [JsonProperty("chat")]
        [JsonPropertyName("chat")]
        public TelegramChatModel Chat { get; set; }

        [JsonProperty("from")]
        [JsonPropertyName("from")]
        public TelegramUserModel From { get; set; }
    }

    [JsonObject(MissingMemberHandling = MissingMemberHandling.Ignore)]
    public class TelegramChatModel
    {
        [JsonProperty("id")]
        [JsonPropertyName("id")]
        public long Id { get; set; }
    }

    [JsonObject(MissingMemberHandling = MissingMemberHandling.Ignore)]
    public class TelegramUserModel
    {
        [JsonProperty("username")]
        [JsonPropertyName("username")]
        public string Username { get; set; }
    }
}
