using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Account
{
    // Личные предпочтения залогиненного пользователя (GET api/Account/Preferences).
    //
    // Отдаются СЫРЫЕ значения, включая null: дефолты сайта здесь НЕ подмешиваются
    // намеренно. Фронт и так получает theme.defaultMode/theme.activePalette из публичных
    // настроек, а различать «выбрано dark» и «выбора нет» ему обязательно — во втором
    // случае экран должен продолжать следовать за админской сменой дефолта.
    public class UserPreferencesModel
    {
        // null = личного выбора нет (см. комментарий выше и поля User).
        public string PreferredTheme { get; set; }
        public string PreferredPalette { get; set; }
        public string PreferredCurrency { get; set; }

        // Не nullable, в отличие от трёх полей выше: у языка и у каналов «выбора нет»
        // состоянием не является.
        public LanguageCode PreferredLanguage { get; set; }
        public NotificationChannelFlags NotificationChannels { get; set; }
    }
}
