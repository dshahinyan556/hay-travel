using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Abstractions;
using ATTours.Common.Infrastructure.EntityConfiguration;
using Microsoft.EntityFrameworkCore;

namespace ATTours.Common.Entities
{
    // Роль пользователя. С гибкой системой прав (architecture-flexible-roles.md §0.1) это
    // уже не фиксированный справочник: роли создаются и редактируются из админки, а права
    // живут в Permissions. Сущность не переименована в Role сознательно — User.RoleId и вся
    // auth-вертикаль уже завязаны на UserRole; переименовывалось бы ради косметики.
    [EntityTypeConfiguration(typeof(UserRoleConfiguration))]
    public class UserRole : EntityBase
    {
        // Отображаемое имя роли (было Description). Уникально — по нему админ различает роли.
        public string Name { get; set; }

        // Стабильный идентификатор ОДНОЙ жёстко зашитой проверки — Employee-эндпоинт
        // (`GetAssignedToMe`, вне скоупа гибких прав). Ни на что другое (в т.ч. на объём
        // прав) не влияет: null у кастомных ролей, заведённых из UI, не значит «меньше прав».
        public RoleType? Type { get; set; }

        // Может ли роль назначать/снимать этот же флаг другим ролям и удалять/понижать
        // пользователей, у которых он стоит (по решению Давида: ни одна роль не защищена
        // от редактирования, включая сидовую «Администратор» — но право трогать ДРУГИЕ
        // такие же мощные роли остаётся эксклюзивом SuperAdmin). Ставить/снимать этот
        // конкретный флаг может ТОЛЬКО SuperAdmin (RoleUpdateService/RoleCreationService) —
        // обычное CRUD-редактирование роли (имя, вся остальная матрица) этому не подчиняется.
        public bool CanManageAdmins { get; set; }

        // Может ли роль входить в аккаунт другого пользователя (feature «Войти как
        // пользователь», spec 014 §3). Не часть матрицы прав — это сквозная привилегия,
        // как CanManageAdmins. Ставить/снимать флаг может ТОЛЬКО SuperAdmin.
        public bool CanImpersonate { get; set; }

        public HashSet<User> Users { get; set; } = [];

        public ICollection<RolePermission> Permissions { get; set; } = [];
    }
}
