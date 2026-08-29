using ATTours.Common.Entities;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.Services.Authorization
{
    // Неприкосновенность аккаунта SuperAdmin (Давид, 2026-08-27): трогать его строку может
    // только он сам. Никакие привилегии вызывающего этого не меняют — ни его собственный
    // IsSuperAdmin, ни роль с CanManageAdmins, — поэтому проверка безусловная и не читает
    // acting-пользователя из БД: сравнения id достаточно.
    //
    // Идёт ПЕРЕД тиром CanManageAdmins из D3/D4: тот guard ключуется на роль цели, а
    // SuperAdmin теоретически может сидеть на роли без этого флага — тогда старая проверка
    // возвращалась бы раньше и запрос проходил бы.
    //
    // Фронт соответствующие действия и так прячет, но это только UI: прямой запрос в обход
    // интерфейса обязан отбиваться здесь (то же требование, что у GuardRoleChange).
    internal static class SuperAdminGuard
    {
        // target — строка, уже прочитанная вызывающим из БД (не claim'ы токена).
        public static void GuardSuperAdminTarget(User target, int actingUserId)
        {
            if (target.IsSuperAdmin && target.Id != actingUserId)
                throw new ErrorModelException(GlobalErrorCode.SuperAdminPrivilegeRequired, HttpStatusCode.Forbidden,
                    "The super administrator account cannot be modified by another user.");
        }
    }
}
