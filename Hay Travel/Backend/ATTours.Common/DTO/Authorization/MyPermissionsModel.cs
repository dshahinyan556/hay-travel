using ATTours.Common.Enums;

namespace ATTours.Common.DTO.Authorization
{
    // GET api/Auth/MyPermissions (architecture-flexible-roles.md §4.1) — контракт гардов
    // фронта. Отдаёт РЕЗОЛВЛЕННЫЙ (роль + override) набор по всем экранам реестра, включая
    // экраны с Level = None (фронт сам решает, прятать или дизейблить).
    //
    // Значения совпадают с запечёнными в JWT, но берутся свежими из БД: UI перерисовывает
    // гарды сразу, тогда как enforcement на бэке подтянется на ближайшей ротации
    // access-токена (§0.2).
    public class MyPermissionsModel
    {
        // Системный Admin — полный доступ; фронт может шорткатить проверки.
        public bool IsAdmin { get; set; }

        // Существующий флаг canManageAdmins — НЕ часть матрицы прав (решение 10 чек-листа).
        public bool IsSuperAdmin { get; set; }

        public List<MyScreenPermissionModel> Screens { get; set; } = [];
    }

    public class MyScreenPermissionModel
    {
        public string ScreenKey { get; set; }
        public AccessLevel Level { get; set; }
    }
}
