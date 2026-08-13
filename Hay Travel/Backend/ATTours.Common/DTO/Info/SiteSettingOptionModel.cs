namespace ATTours.Common.DTO.Info
{
    // Транспортная модель одной опции Select-настройки для админки.
    // Источник — SiteSettingOption из каталога в коде, в БД не хранится.
    public class SiteSettingOptionModel
    {
        public string Value { get; set; }
        public string Label { get; set; }
    }
}
