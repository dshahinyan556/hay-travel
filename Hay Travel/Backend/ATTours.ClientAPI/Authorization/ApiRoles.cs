using ATTours.Common.Enums;

namespace ATTours.ClientAPI.Authorization
{
    // Наборы ролей для [Authorize(Roles = ...)]. Атрибут принимает только константу, поэтому
    // строки собраны здесь один раз, а не продублированы в каждом контроллере.
    // Значения обязаны совпадать с RoleType: именно ToString() роли кладётся в claim
    // (см. JwtTokenService.CreateAccessToken), поэтому расхождение молча закрыло бы доступ.
    public static class ApiRoles
    {
        public const string Admin = nameof(RoleType.Admin);

        // Ведение каталога туров и чтение справочников, из которых собирается тур.
        public const string TourManagerOrAdmin = nameof(RoleType.TourManager) + "," + nameof(RoleType.Admin);
    }
}
