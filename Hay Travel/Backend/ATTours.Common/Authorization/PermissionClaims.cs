using ATTours.Common.DTO.Authorization;
using ATTours.Common.Enums;

namespace ATTours.Common.Authorization
{
    // Формат «запечённых» в access-токен прав и семантика «действие разрешено»
    // (architecture-flexible-roles.md §2.3, §2.6; уровни — spec 014 §1.7, ADR 027).
    // Лежит в Common ровно потому, что писателя (JwtTokenService в Service) и читателя
    // ([RequiresPermission] в ClientAPI) нельзя разводить по двум копиям одного формата —
    // расхождение молча закрыло бы доступ.
    //
    // Строка claim'а: "ключ:БУКВА" через ';', где буква — ОДИН уровень доступа (V/C/U/D),
    // включающий всё, что ниже него. Экраны с уровнем None опускаются целиком
    // (отсутствие ключа = нет доступа).
    // Пример: "dashboard:V;products:U;catalog.tags:V" — products:U это View+Create+Update.
    public static class PermissionClaims
    {
        // Claim присутствует только когда true — как уже сделано для is_super_admin.
        public const string IsAdminClaimType = "is_admin";
        public const string PermissionsClaimType = "perms";

        // Право «войти как пользователь» (spec 014 §2.3). Как is_admin — кладётся в токен
        // только когда true.
        public const string CanImpersonateClaimType = "can_impersonate";

        // Id админа, который вошёл в этот аккаунт (spec 014 §3.2). Есть только у сессии,
        // созданной impersonation'ом; переживает ротацию через RefreshToken.ImpersonatedByUserId.
        public const string ImpersonatedByClaimType = "imp_by";

        public const string TrueValue = "true";

        private const char EntrySeparator = ';';
        private const char KeySeparator = ':';

        private const char NoneLetter = 'N';
        private const char ViewLetter = 'V';
        private const char CreateLetter = 'C';
        private const char UpdateLetter = 'U';
        private const char DeleteLetter = 'D';

        // Уровень — единая лестница: выданный уровень покрывает требуемое действие, если он
        // не ниже него (числа AccessLevel и PermissionAction совпадают, ADR 027).
        public static bool Allowed(ResolvedScreenPermission screen, PermissionAction action)
            => screen is not null && (int)screen.Level >= (int)action;

        public static string Encode(ResolvedPermissionSet permissions)
        {
            if (permissions?.Screens is null)
                return string.Empty;

            var entries = new List<string>();

            foreach (var screen in permissions.Screens)
            {
                if (screen is null || screen.Level < AccessLevel.View)
                    continue;

                entries.Add($"{screen.ScreenKey}{KeySeparator}{ToLetter(screen.Level)}");
            }

            return string.Join(EntrySeparator, entries);
        }

        // Никогда не бросает: битый/чужой claim трактуется как «прав нет», а не как 500.
        public static Dictionary<string, AccessLevel> Parse(string rawClaimValue)
        {
            var parsed = new Dictionary<string, AccessLevel>(StringComparer.OrdinalIgnoreCase);
            if (string.IsNullOrWhiteSpace(rawClaimValue))
                return parsed;

            foreach (var entry in rawClaimValue.Split(EntrySeparator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                var separatorIndex = entry.LastIndexOf(KeySeparator);
                if (separatorIndex <= 0 || separatorIndex == entry.Length - 1)
                    continue;

                var key = entry[..separatorIndex];
                var letters = entry[(separatorIndex + 1)..];

                // Ровно одна буква на экран; мусор/устаревший многобуквенный формат —
                // пропускаем запись целиком (это «нет прав», а не ошибка).
                if (letters.Length != 1 || !TryParseLetter(letters[0], out var level) || level == AccessLevel.None)
                    continue;

                parsed[key] = level;
            }

            return parsed;
        }

        public static bool Allowed(IReadOnlyDictionary<string, AccessLevel> parsedPermissions, string screenKey, PermissionAction action)
        {
            if (parsedPermissions is null || screenKey is null)
                return false;

            return parsedPermissions.TryGetValue(screenKey, out var level) && (int)level >= (int)action;
        }

        private static char ToLetter(AccessLevel level) => level switch
        {
            AccessLevel.View => ViewLetter,
            AccessLevel.Create => CreateLetter,
            AccessLevel.Update => UpdateLetter,
            AccessLevel.Delete => DeleteLetter,
            // None в claim не попадает вовсе (экран опускается) — буква существует только
            // ради полноты switch.
            _ => NoneLetter
        };

        private static bool TryParseLetter(char letter, out AccessLevel level)
        {
            switch (char.ToUpperInvariant(letter))
            {
                case ViewLetter: level = AccessLevel.View; return true;
                case CreateLetter: level = AccessLevel.Create; return true;
                case UpdateLetter: level = AccessLevel.Update; return true;
                case DeleteLetter: level = AccessLevel.Delete; return true;
                case NoneLetter: level = AccessLevel.None; return true;
                default: level = AccessLevel.None; return false;
            }
        }
    }
}
