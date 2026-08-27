namespace ATTours.Common.Enums
{
    // Единый уровень доступа к «экрану» админки (ADR 027). Порядок значений = иерархия:
    // каждый уровень включает всё, что ниже (Delete => Update+Create+View).
    // Числа СОВПАДАЮТ с PermissionAction (View=1..Delete=4), поэтому «выданный уровень
    // покрывает требуемое действие» сводится к grantedLevel >= (int)requiredAction.
    public enum AccessLevel
    {
        None = 0,
        View = 1,
        Create = 2,
        Update = 3,
        Delete = 4
    }
}
