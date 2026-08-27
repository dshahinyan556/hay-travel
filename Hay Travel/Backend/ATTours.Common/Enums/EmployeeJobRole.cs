namespace ATTours.Common.Enums
{
    // Рабочая специализация исполнителя на конкретной брони (Задача D). Отдельный от
    // аккаунтного RoleType набор: RoleType — права доступа к API, EmployeeJobRole — что
    // человек делает на строке заказа. Смешивать их нельзя.
    //
    // Хранится int, наружу уходит числом (подписи мапит фронт, как для OrderStatus/RoleType).
    // Значения начинаются с 1: 0 — это "не задано" в non-nullable контракте назначения,
    // и именно на него опирается гейт OrderAssignEmployeeService (см. EmployeeRoleRequired).
    public enum EmployeeJobRole
    {
        Driver = 1,
        Guide = 2,
        DriverGuide = 3
    }
}
