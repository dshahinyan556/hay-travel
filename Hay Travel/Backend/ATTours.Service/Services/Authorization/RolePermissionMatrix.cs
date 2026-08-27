using ATTours.Common.Authorization;
using ATTours.Common.DTO.Authorization;
using ATTours.Common.Enums;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using System.Net;

namespace ATTours.BusinessServices.Services.Authorization
{
    // Общая валидация входящей матрицы для RoleCreationService/RoleUpdateService/
    // UserPermissionOverrideUpdateService (architecture-flexible-roles.md §3.1, уровни —
    // spec 014 §1.9): неизвестный ключ отбивается, неприменимый к экрану уровень тоже —
    // и то и другое ДО любой записи в БД.
    internal static class RolePermissionMatrix
    {
        private const int MaxRoleNameLength = 256;

        public static string NormalizeName(string name)
        {
            var trimmed = name?.Trim();
            if (string.IsNullOrEmpty(trimmed) || trimmed.Length > MaxRoleNameLength)
                throw new ErrorModelException(GlobalErrorCode.RoleNameInvalid, HttpStatusCode.BadRequest,
                    $"Role name must be non-empty and at most {MaxRoleNameLength} characters.");

            return trimmed;
        }

        // Ключ результата — канонический ключ из реестра (входящий регистр не важен).
        public static Dictionary<string, AccessLevel> Normalize(IEnumerable<ScreenPermissionModel>? incoming)
        {
            var result = new Dictionary<string, AccessLevel>(StringComparer.OrdinalIgnoreCase);
            if (incoming is null)
                return result;

            foreach (var row in incoming)
            {
                if (row is null)
                    continue;

                var definition = RequireScreen(row.ScreenKey);
                result[definition.Key] = RequireAssignableLevel(definition.Key, row.Level);
            }

            return result;
        }

        // То же для персональных override: null («наследовать от роли») сохраняется как
        // есть, а заданный уровень проходит ту же проверку применимости, что и у роли.
        public static Dictionary<string, AccessLevel?> NormalizeOverrides(IEnumerable<ScreenOverrideModel>? incoming)
        {
            var result = new Dictionary<string, AccessLevel?>(StringComparer.OrdinalIgnoreCase);
            if (incoming is null)
                return result;

            foreach (var row in incoming)
            {
                if (row is null)
                    continue;

                var definition = RequireScreen(row.ScreenKey);

                result[definition.Key] = row.Level is null
                    ? null
                    : RequireAssignableLevel(definition.Key, row.Level.Value);
            }

            return result;
        }

        // Неприменимый уровень — это ошибка запроса, а не повод молча его урезать: иначе
        // UI показывал бы «выдал Update», а в БД лежало бы что-то другое.
        private static AccessLevel RequireAssignableLevel(string screenKey, AccessLevel level)
        {
            if (!Enum.IsDefined(level) || !AdminScreens.IsAssignableLevel(screenKey, level))
                throw new ErrorModelException(GlobalErrorCode.InvalidPermissionLevel, HttpStatusCode.BadRequest,
                    $"Permission level '{level}' is not applicable to admin screen '{screenKey}'.");

            return level;
        }

        private static ScreenDefinition RequireScreen(string screenKey)
            => AdminScreens.Find(screenKey)
               ?? throw new ErrorModelException(GlobalErrorCode.UnknownScreenKey, HttpStatusCode.BadRequest,
                   $"Unknown admin screen key '{screenKey}'.");
    }
}
