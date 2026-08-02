using ATTours.Common.DTO.Init;

namespace ATTours.Common.DTO.Request
{
    // Команда на сохранение одной настройки.
    // Идентичность записи — Key, а не Id: у ещё не сохранённого ключа Id = 0.
    public class SiteSettingUpdateModel
    {
        public string Key { get; set; }
        public string Value { get; set; }

        // Type у перевода настройки не используется и игнорируется.
        public List<TranslatableCreateModel> Translations { get; set; }
    }
}
