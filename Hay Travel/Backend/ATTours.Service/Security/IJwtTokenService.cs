using ATTours.Common.DTO.Auth;
using ATTours.Common.DTO.Authorization;
using ATTours.Common.Entities;

namespace ATTours.BusinessServices.Security
{
    public interface IJwtTokenService
    {
        // Требует загруженного user.Role — роль попадает в claim и определяет доступ.
        // permissions — уже резолвленный набор прав (PermissionResolutionService): он
        // печётся в claim'ы is_admin/perms, по которым авторизуются админ-эндпоинты
        // (architecture-flexible-roles.md §2.6). Резолв здесь не делается: сервис
        // stateless-singleton и в БД не ходит.
        //
        // impersonatedByUserId — id админа, вошедшего в этот аккаунт (spec 014 §3.2):
        // передаётся при impersonation и на каждой последующей ротации (значение живёт на
        // строке RefreshToken), уезжает в claim imp_by. null у обычных сессий.
        AccessTokenModel CreateAccessToken(User user, ResolvedPermissionSet permissions, int? impersonatedByUserId = null);

        // rememberMe задаёт длину скользящего окна сессии (ADR 029): 14 дней против
        // Jwt:InactivityMinutes. Окно пересчитывается от «сейчас» и при каждой ротации.
        GeneratedRefreshToken CreateRefreshToken(bool rememberMe);

        // Тот же алгоритм, что и при выдаче: нужен, чтобы найти строку по предъявленному
        // plaintext-токену из cookie.
        string HashRefreshToken(string token);
    }
}
