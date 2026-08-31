using ATTours.Common.Enums;

namespace ATTours.Common.Authorization
{
    // Одна запись реестра: строковый ключ, человекочитаемое имя для матрицы на фронте и
    // набор действий, которые к этому экрану вообще применимы (у регионов нет Create/Delete,
    // у дашборда — только View).
    public sealed record ScreenDefinition(
        string Key,
        string DisplayName,
        IReadOnlyList<PermissionAction> Actions);

    // ЕДИНСТВЕННОЕ место, где перечислены экраны админки (architecture-flexible-roles.md §0.6, §5).
    // Читают: атрибуты контроллеров ([RequiresPermission]), резолвер прав, GET api/Screens,
    // валидация входящих матриц. Ни ядро авторизации, ни схема БД про конкретные экраны не
    // знают — добавление/переименование/удаление экрана это правка ТОЛЬКО этого файла плюс
    // атрибута на контроллере, без миграций (§5).
    //
    // Строки, а не enum: ключи содержат точку-неймспейс (catalog.places), хранятся в
    // RolePermission.ScreenKey как nvarchar и 1:1 совпадают с ключами фронта.
    public static class AdminScreens
    {
        public const string Dashboard = "dashboard";
        public const string Products = "products";
        public const string Calendar = "calendar";
        public const string Orders = "orders";
        public const string CatalogPlaces = "catalog.places";
        public const string CatalogExpenseTemplates = "catalog.expense-templates";
        public const string CatalogNoteTemplates = "catalog.note-templates";
        public const string CatalogRegions = "catalog.regions";
        public const string CatalogTags = "catalog.tags";
        // Классы авто для трансферов (батч 2026-08-29, решение 0.7). Отдельного пункта меню
        // у трансферов нет (решение 0.3) — это вкладка в Справочниках, как теги.
        public const string CatalogVehicleClasses = "catalog.vehicle-classes";
        public const string Users = "users";
        public const string Roles = "roles";
        public const string Notifications = "notifications";
        // Библиотека шаблонов писем/Telegram-сообщений (2026-08-31) — отдельный от
        // «Настроек уведомлений» экран: тот решает кому/когда слать, этот — открытый
        // CRUD-справочник самого содержимого.
        public const string NotificationTemplates = "notification-templates";
        public const string Settings = "settings";
        public const string Jobs = "jobs";

        private static readonly IReadOnlyList<PermissionAction> ViewOnly =
            [PermissionAction.View];

        private static readonly IReadOnlyList<PermissionAction> ViewUpdate =
            [PermissionAction.View, PermissionAction.Update];

        private static readonly IReadOnlyList<PermissionAction> ViewCreateDelete =
            [PermissionAction.View, PermissionAction.Create, PermissionAction.Delete];

        private static readonly IReadOnlyList<PermissionAction> ViewUpdateDelete =
            [PermissionAction.View, PermissionAction.Update, PermissionAction.Delete];

        private static readonly IReadOnlyList<PermissionAction> FullCrud =
            [PermissionAction.View, PermissionAction.Create, PermissionAction.Update, PermissionAction.Delete];

        // Порядок = порядок строк в матрице на фронте.
        public static readonly IReadOnlyList<ScreenDefinition> All =
        [
            new(Dashboard, "Дашборд", ViewOnly),
            new(Products, "Туры и экскурсии", FullCrud),
            // Update у правил закрытия намеренно нет: правка это удалить + создать (ADR 012).
            new(Calendar, "Календарь и блокировки", ViewCreateDelete),
            new(Orders, "Заказы", FullCrud),
            new(CatalogPlaces, "Каталог: точки", FullCrud),
            new(CatalogExpenseTemplates, "Каталог: доп. расходы", FullCrud),
            new(CatalogNoteTemplates, "Каталог: заметки", FullCrud),
            // Набор регионов фиксирован сидом — редактируется только тизер.
            new(CatalogRegions, "Каталог: регионы", ViewUpdate),
            new(CatalogTags, "Каталог: теги", FullCrud),
            // Новый экран без строк в RolePermission виден только SuperAdmin (deny by default,
            // §5) — миграция прав не нужна, доступ раздаётся с экрана «Роли и права».
            new(CatalogVehicleClasses, "Классы авто", FullCrud),
            // Create нет: пользователи регистрируются сами.
            new(Users, "Пользователи", ViewUpdateDelete),
            // Управление самой системой ролей/прав — теперь обычный гейтируемый экран, а не
            // жёстко зашитый Admin-only мета-экран: любая роль может как получить, так и
            // потерять доступ к нему (никакой роли не гарантирован доступ навсегда).
            new(Roles, "Роли и права", FullCrud),
            // Набор событий фиксирован кодом (5 action-key) — Create/Delete не нужны.
            new(Notifications, "Настройки уведомлений", ViewUpdate),
            // Открытый CRUD (2026-08-31): админ создаёт/удаляет свои шаблоны сам.
            new(NotificationTemplates, "Шаблоны уведомлений", FullCrud),
            // Набор ключей настроек фиксирован каталогом в коде (ADR 002).
            new(Settings, "Настройки сайта", ViewUpdate),
            // Набор фоновых задач фиксирован BackgroundJobCatalog — Create/Delete не нужны.
            // Update покрывает и рубильник, и расписание, и «Запустить сейчас»: все трое
            // меняют поведение планировщика, отдельного действия под ручной запуск в
            // PermissionAction нет (и заводить его ради одной кнопки незачем).
            new(Jobs, "Фоновые задачи", ViewUpdate)
        ];

        // Инициализируется после All (статические поля выполняются в текстовом порядке).
        private static readonly Dictionary<string, ScreenDefinition> ByKey =
            All.ToDictionary(screen => screen.Key, StringComparer.OrdinalIgnoreCase);

        public static bool IsKnown(string key) => key is not null && ByKey.ContainsKey(key);

        public static ScreenDefinition Find(string key)
            => key is not null && ByKey.TryGetValue(key, out var definition) ? definition : null;

        // Применимо ли действие к экрану. Неизвестный ключ — не применимо ничего (deny by default).
        public static bool Supports(string key, PermissionAction action)
        {
            var definition = Find(key);
            return definition is not null && definition.Actions.Contains(action);
        }

        // Наивысшее применимое к экрану действие, не превышающее level (ADR 027). Обрезает
        // переданный уровень до того, что экран реально поддерживает — закрывает и
        // «хвостовые», и «внутренние» пробелы (у calendar нет Update между Create и Delete).
        // Возвращает None, если ни одно применимое действие не проходит по уровню.
        public static AccessLevel CapLevel(string key, AccessLevel level)
        {
            if (level == AccessLevel.None) return AccessLevel.None;
            var def = Find(key);
            if (def is null) return AccessLevel.None;

            AccessLevel capped = AccessLevel.None;
            foreach (var action in def.Actions)
                if ((int)action <= (int)level && (int)action > (int)capped)
                    capped = (AccessLevel)(int)action;
            return capped;
        }

        // Уровень допустим для записи в матрицу, только если он None или ТОЧНО одно из
        // применимых действий экрана (нельзя выдать Update у catalog.regions).
        public static bool IsAssignableLevel(string key, AccessLevel level)
            => level == AccessLevel.None || CapLevel(key, level) == level;
    }
}
