using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Info
{
    // Административное представление настройки: значение из БД + метаданные из каталога.
    public class SiteSettingInfoModel
    {
        // 0 = ключ известен каталогу, но ещё ни разу не сохранялся в БД.
        public int Id { get; set; }
        public string Key { get; set; }

        #region Метаданные из SiteSettingCatalog (в БД не хранятся)
        public SiteSettingGroup Group { get; set; }
        public SettingValueType ValueType { get; set; }
        public bool IsTranslatable { get; set; }
        public bool IsPublic { get; set; }
        public int SortOrder { get; set; }
        #endregion

        public string Value { get; set; }
        public List<TranslatableInfoModel> Translations { get; set; }
    }
}
