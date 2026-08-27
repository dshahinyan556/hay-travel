using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Персональный override прав поверх роли: одна строка на (пользователь, экран).
    // Уровень nullable — null означает «наследовать от роли», значение перекрывает
    // роль в обе стороны (и расширяет, и урезает).
    [EntityTypeConfiguration(typeof(UserPermissionOverrideConfiguration))]
    public class UserPermissionOverride : EntityBase
    {
        public int UserId { get; set; }
        public User User { get; set; }

        // Одно из AdminScreens.* — валидируется в сервисах через AdminScreens.IsKnown.
        public string ScreenKey { get; set; }

        // null = наследовать от роли; значение перекрывает уровень роли (ADR 027).
        public AccessLevel? Level { get; set; }
    }
}
