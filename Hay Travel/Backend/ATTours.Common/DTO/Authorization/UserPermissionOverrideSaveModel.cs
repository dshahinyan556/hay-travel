using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Authorization
{
    // Тело PUT api/Users/{id}/PermissionOverrides. Перезаписывает набор override целиком:
    // экран, которого нет в списке, теряет свой override и снова наследует роль.
    public class UserPermissionOverrideSaveModel
    {
        // Дублирует id из маршрута (маршрут — источник истины, поле для удобства фронта).
        public int UserId { get; set; }

        public List<ScreenOverrideModel> Overrides { get; set; } = [];
    }

    // Level nullable: null = наследовать от роли, значение перекрывает уровень роли
    // (и расширяя, и урезая — вплоть до None). null — строка override не нужна и удаляется.
    public class ScreenOverrideModel
    {
        public string ScreenKey { get; set; }
        public AccessLevel? Level { get; set; }
    }
}
