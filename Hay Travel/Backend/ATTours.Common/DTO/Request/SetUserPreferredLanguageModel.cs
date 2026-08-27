using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Request
{
    // Язык писем пользователя. Non-nullable: "языка нет" — не состояние, у поля есть
    // безопасный дефолт (Russian), и значение вне enum не отбивается ошибкой, а падает
    // в дефолт с warning'ом (см. UserPreferredLanguageUpdateService).
    public class SetUserPreferredLanguageModel
    {
        public int UserId { get; set; }
        public LanguageCode PreferredLanguage { get; set; }
    }
}
