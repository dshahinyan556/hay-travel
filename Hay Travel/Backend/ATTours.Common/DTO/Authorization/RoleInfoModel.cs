using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Authorization
{
    // Роль для экрана управления ролями (GET api/Roles). Permissions приходят по ВСЕМ
    // экранам реестра — отсутствующие в БД строки разворачиваются в Level = None, чтобы
    // фронт строил полную таблицу без догадок (architecture-flexible-roles.md §3.2).
    public class RoleInfoModel
    {
        public int Id { get; set; }
        public string Name { get; set; }

        // null у кастомных ролей: Type — стабильный идентификатор ТОЛЬКО для Employee-эндпоинта,
        // на объём прав не влияет (см. UserRole.cs).
        public RoleType? Type { get; set; }

        // Может ли эта роль трогать (удалять/понижать/повышать) других носителей этого же
        // флага. Ставить/снимать его в UI может только SuperAdmin — обычное редактирование
        // роли (имя, вся остальная матрица) этому не подчиняется.
        public bool CanManageAdmins { get; set; }

        // Может ли роль входить в чужой аккаунт (spec 014 §2.2). Тот же SuperAdmin-only
        // режим правки, что и у CanManageAdmins.
        public bool CanImpersonate { get; set; }

        // Сколько не-удалённых пользователей на роли — UI показывает, почему удаление запрещено.
        public int UserCount { get; set; }

        public List<ScreenPermissionModel> Permissions { get; set; } = [];
    }

    // Одна строка матрицы: экран + выданный уровень (None = нет доступа).
    public class ScreenPermissionModel
    {
        public string ScreenKey { get; set; }
        public AccessLevel Level { get; set; }
    }
}
