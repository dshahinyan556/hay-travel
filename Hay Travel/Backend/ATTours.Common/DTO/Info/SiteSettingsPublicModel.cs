namespace ATTours.Common.DTO.Info
{
    // Публичное представление настроек: плоский словарь «ключ -> разрешённое значение»
    // для одной локали. Значение уже разрешено по правилу
    // перевод(язык) ?? Value ?? DefaultValue, поэтому null здесь не бывает.
    public class SiteSettingsPublicModel
    {
        public int LanguageCode { get; set; }
        public Dictionary<string, string> Values { get; set; } = [];
    }
}
