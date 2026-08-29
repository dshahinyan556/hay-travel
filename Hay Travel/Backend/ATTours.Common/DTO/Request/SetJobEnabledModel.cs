namespace ATTours.Common.DTO.Request
{
    // Рубильник фоновой задачи. Ключ приходит сегментом маршрута (api/Jobs/{key}/Enabled),
    // а не полем тела: он часть адреса ресурса, и дублирование позволило бы прислать
    // расходящуюся пару.
    public class SetJobEnabledModel
    {
        public bool IsEnabled { get; set; }
    }
}
