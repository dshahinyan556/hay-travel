namespace ATTours.Common.Enums
{
    public enum RoleType
    {
        Regular = 1,
        TourManager,
        Admin,
        // Read-only доступ к заказам/строкам, где назначен исполнителем (checklist-orders-
        // redesign.txt, Фаза 2). Не переиспользует TourManager — у того полный доступ на
        // управление турами/местами/регионами, это другая граница прав.
        Employee
    }
}
