using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Права роли на один «экран» админки: одна строка на (роль, экран).
    // Отсутствие строки = нет прав (deny by default) — резолвер итерирует по реестру
    // AdminScreens, а не по этой таблице, поэтому осиротевшие/недостающие ключи безвредны.
    [EntityTypeConfiguration(typeof(RolePermissionConfiguration))]
    public class RolePermission : EntityBase
    {
        public int RoleId { get; set; }
        public UserRole Role { get; set; }

        // Одно из AdminScreens.* — валидируется в сервисах через AdminScreens.IsKnown.
        public string ScreenKey { get; set; }

        // Единый уровень доступа (ADR 027): None = нет доступа (раньше: все четыре флага
        // false / отсутствие строки). Уровень включает всё, что ниже него.
        public AccessLevel Level { get; set; }
    }
}
