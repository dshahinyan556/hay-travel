namespace ATTours.Common.Enums
{
    // Подсказка для рендера контрола в админке и для валидации.
    // Тип хранения у всех настроек один — строка.
    public enum SettingValueType
    {
        Text = 1,
        MultilineText = 2,
        Url = 3,
        ImageUrl = 4,
    }
}
