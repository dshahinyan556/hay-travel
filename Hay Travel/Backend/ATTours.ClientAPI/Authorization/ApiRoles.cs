using ATTours.Common.Enums;

namespace ATTours.ClientAPI.Authorization
{
    // Наборы ролей для [Authorize(Roles = ...)]. Атрибут принимает только константу, поэтому
    // строки собраны здесь один раз, а не продублированы в каждом контроллере.
    // Значения обязаны совпадать с RoleType: именно ToString() роли кладётся в claim
    // (см. JwtTokenService.CreateAccessToken), поэтому расхождение молча закрыло бы доступ.
    //
    // С переходом на гибкие права (architecture-flexible-roles.md §2.7, обновлено
    // 2026-08-22) ВСЯ админка, включая управление самими ролями и уведомлениями, гейтится
    // матрицей ([RequiresPermission]) — ни одна роль не привязана к коду. Единственный
    // оставшийся жёсткий гейт — Employee, read-only эндпоинт исполнителя (решение 9
    // чек-листа), сознательно не переведённый на матрицу.
    public static class ApiRoles
    {
        // Read-only доступ к своим назначенным заказам (checklist-orders-redesign.txt, Фаза 2).
        public const string Employee = nameof(RoleType.Employee);
    }
}
