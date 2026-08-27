namespace ATTours.Common.Enums
{
    // Четыре независимых действия над «экраном» админки (architecture-flexible-roles.md §1.2).
    // View — ворота доступа: без него экран недоступен целиком, остальные три требуют его
    // дополнительно (семантика резолва §2.3), но между собой не образуют иерархии.
    public enum PermissionAction
    {
        View = 1,
        Create = 2,
        Update = 3,
        Delete = 4
    }
}
