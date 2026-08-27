# Архитектура: гибкая система ролей и прав — ФРОНТЕНД

Проектный документ для `frontend-developer` и `ui-ux-engineer`. Покрывает **Этапы 0.2, 5, 6**
чек-листа `docs/checklists/checklist-flexible-roles.txt` (подключение резолвленных прав к
роутеру и гардам, экран управления ролями, замена гардов на всех 11 экранах). Этап 7 (QA) —
зона `tester`, здесь только перечень того, что должно быть проверяемо.

Вход этого документа — **§4 «Контракт для фронтенда»** в
[architecture-flexible-roles.md](architecture-flexible-roles.md). Всё, что там написано про
DTO и эндпоинты, здесь считается данностью и не переобсуждается. Обоснование ключевой развилки
(эндпоинт против клейма JWT) вынесено в
[ADR 024](adr/024-frontend-permissions-from-mypermissions-endpoint.md).

Реализовывать строго по этому документу. Все открытые вопросы решены в §0. Ориентиры по стилю —
существующий код, конкретно:

- **Модульный стор + `useSyncExternalStore`** — `shared/auth/authStore.ts` + `shared/auth/useAuth.ts`
  ([ADR 007](adr/007-frontend-auth-store-module-level-and-jwt-decode.md)). Новый стор прав
  повторяет этот файл структурно: приватное `state`, `Set` слушателей, `setState`, single-flight
  промис.
- **Экран-CRUD админки** — `features/admin/notifications/` (лоадер + страница + компоненты +
  `lib/<модуль>Copy.ts`). Самый близкий по масштабу образец для `features/admin/roles/`.
- **Форма с dirty-tracking и baseline** — `features/admin/settings/hooks/useSettingsForm.ts`
  (state + baseline + `dirtyCount` + `submit`, без редьюсера — «две операции не оправдывают
  action-union»).
- **Локализация админки** — `shared/i18n/defineCopy.ts` + `features/admin/layout/adminLayoutCopy.ts`
  ([ADR 021](adr/021-admin-panel-localization.md)). Правило жёсткое: **ни одной строки интерфейса
  литералом в JSX**.
- **Кросс-модульные админские примитивы** — `features/admin/ui/` (`SidePanel`, `TourTableParts`,
  `EmployeeJobRoleSelect`), кросс-модульные подписи — `features/admin/lib/adminEnumsCopy.ts`.

---

## §0. Решения по открытым вопросам

### 0.1. Источник прав — `GET api/Auth/MyPermissions`, не декод JWT

Полностью в [ADR 024](adr/024-frontend-permissions-from-mypermissions-endpoint.md), Решение 1.
Коротко: клейм `perms` лоссовый (экраны с `canView=false` из него выброшены) и является
внутренним форматом токена, а не контрактом; `MyPermissions` спроектирован ровно под эту задачу
и отдаёт все 11 экранов свежими из БД. Довод ADR 007 («не трогать готовый бэкенд ради того, что
решается в браузере») здесь неприменим: эндпоинт пишется в этом же спринте специально для фронта.

**Единственный бит, который читается из токена** — `AuthUser.hasPanelAccess`: `is_admin === true`
ИЛИ клейм `perms` непустой. Он нужен публичному сайту (ссылка «Админ-панель» в `UserMenu` и на
`/account`), где грузить всю матрицу ради одной ссылки — расточительство. Это проверка на
непустоту, а не парсинг грамматики.

### 0.2. Где живёт состояние — отдельный модульный стор `permissionStore`

Паттерн ADR 007 сохраняется дословно и **не заменяется на Context**: гарды живут в лоадерах
React Router, лоадеры выполняются вне дерева компонентов и контекст прочитать не могут.

Матрица кладётся **не** в `AuthState`, а в отдельный модуль `shared/auth/permissionStore.ts`
со своей парой `subscribe`/`getSnapshot` (ADR 024, Решение 3): разные жизненные циклы (сессия —
у любого посетителя, матрица — только у персонала в `/admin`), разные источники, разные частоты
обновления. Складывать их в один снапшот значит перерисовывать публичный сайт на события,
которые его не касаются — тот же довод, по которому access-токен не входит в `AuthState`.

### 0.3. Когда грузится и обновляется

| Событие | Что происходит |
| --- | --- |
| Открыт публичный маршрут | Ничего. Матрица не грузится никогда. |
| Открыт любой маршрут под `/admin` | Лоадер зовёт `ensurePermissionsReady()` (single-flight, внутри ждёт `ensureAuthReady()`), при первом вызове — один `GET api/Auth/MyPermissions`. |
| `login()` | `invalidatePermissions()`. Набора ещё нет → сети нет; загрузится лоадером, если пошли в `/admin`. |
| `refreshAccessToken()` успешен | `invalidatePermissions()`. Если набор **уже был загружен** (админская сессия) — сразу фоновой перезапрос, подписчики перерисовываются. |
| `logout()` | `clearPermissions()` — снапшот сбрасывается в `idle`, пустой. |
| Админ сохранил свою же роль/override | Экраны ролей и пользователей после успешного сохранения зовут `refreshPermissions()` (см. §3.7, §4.4). |

**Почему инвалидация привязана к ротации токена, а не к таймеру/навигации:** бэкенд резолвит
права из БД ровно в момент выпуска токена. Перечитывая `MyPermissions` в тот же момент, фронт
держит UI и энфорсмент в одном состоянии БД, и окно «UI показывает кнопку, которая ответит 403»
схлопывается с 15 минут до времени между двумя соседними запросами (ADR 024, Решение 2).

### 0.4. Форма предикатов: универсальные по (`screenKey`, `action`), именованных обёрток НЕ будет

`canManageTours` / `canDeleteTours` / `canFeatureTours` / `canViewCatalog` / `canManageCatalog` /
`canManageCalendar` / `canManageUsers` / `canManageSettings` / `canManageNotifications` /
`canPublishTours` / `canArchiveTours` — **удаляются**, тонкие обёртки поверх нового API не
создаются.

Обоснование:

- **Один-к-одному они не переводятся, перевод был бы ложью.** `canManageCalendar` гейтит и
  `/admin/calendar`, и `/admin/orders` — в новой модели это два независимых ключа.
  `canManageCatalog` гейтит пять ключей. `canViewCatalog` — четыре. `canManageTours` — это
  `products.Create` И `products.Update` одновременно. Обёртка, которая «сохраняет старое имя»,
  склеила бы обратно то, ради разделения чего делается вся задача.
- **Обёртки вернули бы `permissions.ts` в чек-лист «добавили экран».** Жёсткое требование 11
  чек-листа — добавление экрана должно быть механическим. Универсальный предикат по ключу это
  даёт; список именованных обёрток — нет.
- **Цена миграции мала и уже измерена.** Всего 14 мест использования старых предикатов
  (`grep` по `src/`, факт на 2026-08-22) — они все перечислены в §2.3 и §2.4 с готовой заменой.
  Экономить на переписывании 14 строк ценой постоянной второй системы имён невыгодно.

Остаются **вне матрицы** (это не роль-права, а отдельные механизмы):
`canManageAdmins(user)` — SuperAdmin, решение 10 чек-листа, не трогаем;
`canOpenAdminPanel(user)` — бит из токена для публичного сайта (§0.1).

### 0.5. Мета-экраны гейтятся `isAdmin()`, а не 12-м ключом матрицы

Чек-лист (5.2) предполагал завести `/admin/roles` 12-м ключом прав. **Отменяется** в пользу §0.5
бэкенд-документа: `api/Roles`, `api/Screens` и `api/EmailTemplate` остаются на жёстком
`[Authorize(Roles = ApiRoles.Admin)]` и матрицу не читают. Завести на фронте 12-й ключ значило бы
рисовать в редакторе строку, галочки в которой ни на что не влияют, — это хуже, чем отсутствие
строки.

Поэтому: `/admin/roles`, `/admin/roles/:id` и `/admin/notifications` гейтятся предикатом
`isAdmin()` (флаг `MyPermissionsModel.isAdmin`). Блок персональных override на карточке
пользователя — тоже (§4.1). Когда мета-экран понадобится отдать кастомной роли — это
механическая операция на бэкенде (§5 бэкенд-документа) плюс замена `isAdmin()` на
`canView(AdminScreen.X)` в одном месте здесь.

### 0.6. Два реестра на фронте: ключи экранов и навигация

- `shared/auth/screens.ts` — зеркало `AdminScreens` бэкенда: константы ключей + порядок. Нужен
  ради типобезопасности вызовов (`AdminScreen.Orders` вместо строки `'orders'`).
- `features/admin/layout/adminNav.ts` — единственное место, где ключ экрана связан с маршрутом,
  подписью и иконкой. Его читают **и** `AdminSidebar` (фильтрация пунктов), **и**
  `firstVisibleAdminPath()` (куда отправить того, кому дашборд не виден).

Реестр экранов, приезжающий с бэкенда (`GET api/Screens`), — источник истины для **редактора
матрицы**: строки и применимые действия строятся по нему, а не по локальному списку. Локальный
список нужен только для гардов. Расхождение поэтому безопасно: новый ключ, которого фронт ещё
не знает, всё равно появится в редакторе (с RU-подписью от бэкенда) и им можно управлять.

### 0.7. Обязательный регресс: роль стала nullable

Бэкенд делает `UserRole.Type` nullable (§0.1 бэкенд-документа): у кастомной роли `Type = null`,
значит **`ClaimTypes.Role` в токен не добавляется** (§2.6 бэкенд-документа), а
`UserInfoModel.Role`/`UserDetailInfoModel.Role` становятся `RoleType?` + появляется `RoleName`.

Это ломает три места, и их починка входит в скоуп:

1. `decodeAccessToken` сейчас возвращает `null`, если роль в токене не найдена
   (`if (… || role === undefined) return null`). Для пользователя на кастомной роли это означало
   бы **полный отказ восстановления сессии после F5** — не «нет прав», а «разлогинен». Роль
   перестаёт быть обязательным полем декода.
2. `AuthUser.role` → `RoleType | null`.
3. `UserInfoModel.role`/`UserDetailInfoModel.role` → `RoleType | null`, `+ roleName: string`.
   Все места, где подпись роли берётся как `roleLabels[user.role]`, переходят на `user.roleName`.

### 0.8. Пять ключей каталога на один маршрут

`/admin/catalog` — одна страница с пятью вкладками, но пять независимых ключей прав.

- Маршрут виден, если виден **хотя бы один** ключ каталога → предикат `canViewAny([...])`.
- Лоадер грузит только те списки, чей ключ видим; недоступные — `null`, соответствующая вкладка
  не рендерится вовсе (не «пустая», а отсутствует).
- Кнопки внутри вкладки гейтятся ключом **своей** вкладки.

**Связанное ограничение, которое надо знать администратору:** форма тура
(`tourCreateLoader`/`tourEditLoader`) читает `Place/GetAll`, `ExpenseTemplate/GetAll`,
`TourNoteTemplate/GetAll`, `Region/GetAll`, `Tag/GetAll` — то есть роль с `products.Create` без
`catalog.*.View` получит 403 на самой форме. Деградацию до пустых пикеров **не делаем** (она
прячет ошибку конфигурации). Вместо этого редактор матрицы показывает предупреждение прямо в
строке `products`, когда Create/Update выданы без всех пяти View (§3.6).

### 0.9. Локализация

Новый экран подчиняется [ADR 021](adr/021-admin-panel-localization.md): свой
`features/admin/roles/lib/rolesCopy.ts` через `defineCopy(ru, en)`, чтение через `useCopy`.

Подписи экранов в матрице **не берутся** из `ScreenDefinitionModel.displayName` напрямую:
бэкенд отдаёт только RU. Используется `features/admin/lib/adminScreensCopy.ts` —
`Record<ScreenKey, string>` в RU и EN, **с фолбэком на `displayName` для незнакомого ключа**.
Так добавление экрана на бэкенде не ломает фронт (строка появится с русской подписью), а
добавление EN-подписи остаётся однострочной правкой.

### 0.10. Что делать, когда права меняются, а токен ещё старый

Бэкенд энфорсит по токену, поэтому расширение прав реально начинает работать после ротации
(≤15 мин). §0.3 сводит окно к минимуму, но полностью его не убирает. Поэтому:

- 403 на админском действии → сообщение не «недостаточно прав», а «права изменились: они
  вступят в силу в течение 15 минут или сразу после повторного входа» (`rolesCopy.permissionLag`,
  `adminLayoutCopy.errorBoundary.forbiddenLagHint`).
- Экран ролей после успешного сохранения показывает ту же подсказку один раз (§3.7).

---

## §1. Слой `shared/auth`

### 1.1. `shared/auth/screens.ts` — **создать**

Zero-import лист (как `shared/types/employeeRole.ts`), чтобы его могли импортировать и
`types.ts`, и любая фича без риска цикла.

```ts
/** Зеркало ATTours.Common/Authorization/AdminScreens.cs. Порядок = порядок строк в матрице. */
export const AdminScreen = {
  Dashboard: 'dashboard',
  Products: 'products',
  Calendar: 'calendar',
  Orders: 'orders',
  CatalogPlaces: 'catalog.places',
  CatalogExpenseTemplates: 'catalog.expense-templates',
  CatalogNoteTemplates: 'catalog.note-templates',
  CatalogRegions: 'catalog.regions',
  CatalogTags: 'catalog.tags',
  Users: 'users',
  Settings: 'settings',
} as const

/** Ключ, известный этой сборке фронта. Все вызовы предикатов типизируются им. */
export type KnownScreenKey = (typeof AdminScreen)[keyof typeof AdminScreen]

/** Ключ «с провода»: редактор матрицы работает с тем, что прислал GET api/Screens, включая
 *  ключи, которых эта сборка ещё не знает. */
export type ScreenKey = string

/** Все известные ключи в порядке бэкендового реестра. */
export const ALL_SCREEN_KEYS: readonly KnownScreenKey[]

/** Зеркало ATTours.Common/Enums/PermissionAction.cs. Const-объект, а не TS-enum:
 *  tsconfig ставит erasableSyntaxOnly — та же конвенция, что у RoleType. */
export const PermissionAction = { View: 1, Create: 2, Update: 3, Delete: 4 } as const
export type PermissionAction = (typeof PermissionAction)[keyof typeof PermissionAction]

/** Порядок колонок в матрице. */
export const ALL_PERMISSION_ACTIONS: readonly PermissionAction[]

/** Пять ключей каталога — используется гардом /admin/catalog и nav-реестром. */
export const CATALOG_SCREEN_KEYS: readonly KnownScreenKey[]
```

### 1.2. `shared/auth/types.ts` — **изменить**

Добавить (wire-DTO `GET api/Auth/MyPermissions`, §4.1 бэкенд-документа):

```ts
export interface MyScreenPermissionModel {
  screenKey: string
  canView: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}

export interface MyPermissionsModel {
  isAdmin: boolean
  isSuperAdmin: boolean
  /** По ВСЕМ ключам реестра, включая canView=false. */
  screens: MyScreenPermissionModel[]
}
```

Изменить:

```ts
export interface AuthUser {
  id: number
  username: string
  email: string
  /** null у пользователя на КАСТОМНОЙ роли: у неё UserRole.Type = null, поэтому role-клейма
   *  в токене нет. Не «нет роли», а «роль не системная» (§0.7). */
  role: RoleType | null
  /** Есть ли у аккаунта доступ хоть к чему-то в /admin. Пишется ТОЛЬКО из access-токена
   *  (is_admin=true или непустой perms) — те же 4 write site, что и у isSuperAdmin (ADR 011).
   *  Нужен публичному сайту, который матрицу прав не грузит (ADR 024, Решение 1). */
  hasPanelAccess?: boolean
  firstName?: string
  lastName?: string | null
  phoneNumber?: string
  isEmailVerified?: boolean
  isSuperAdmin?: boolean
}

export interface UserInfoModel {
  …
  roleId: number
  role: RoleType | null   // было RoleType
  roleName: string        // новое: имя роли, единственный источник подписи в UI
  …
}

export interface UserDetailInfoModel {
  …
  role: RoleType | null   // было RoleType
  roleName: string        // новое
  …
}
```

### 1.3. `shared/auth/permissionsApi.ts` — **создать**

Образец — `shared/auth/authApi.ts` (тот же слой, та же роль: «API, которым пользуется сам стор»).

```ts
import { apiFetch } from '@/shared/lib/http'
import type { MyPermissionsModel } from './types'

/** GET api/Auth/MyPermissions.
 *
 *  Через apiFetch, а НЕ authFetch: authFetch зависит от authStore, а authStore зависит от
 *  permissionStore — импорт authFetch замкнул бы цикл (ADR 024, Решение 3). Bearer-токен всё
 *  равно уезжает: authStore зарегистрировал setAuthTokenProvider в shared/lib/http.
 *  Бросает ApiError (401/403/сеть) — обрабатывает вызывающий стор. */
export function fetchMyPermissions(): Promise<MyPermissionsModel>
```

### 1.4. `shared/auth/permissionStore.ts` — **создать**

Структура файла — копия `authStore.ts` по форме: приватные `state`/`listeners`, `setState`,
single-flight промис, экспортируемые функции.

```ts
export interface ScreenPermission {
  canView: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}

/** 'idle' — не грузили; 'loading' — запрос в полёте; 'ready' — набор актуален;
 *  'error' — последняя попытка провалилась (снапшот пустой, все предикаты дают false). */
export type PermissionStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface PermissionSnapshot {
  status: PermissionStatus
  isAdmin: boolean
  isSuperAdmin: boolean
  /** Ключ → флаги. Ключи, которых нет в ответе, отсутствуют (предикаты дают false). */
  screens: Readonly<Record<ScreenKey, ScreenPermission>>
}

export function getPermissions(): PermissionSnapshot
export function subscribePermissions(listener: () => void): () => void

/** Гарантирует, что набор загружен. Внутри: await ensureAuthReady(); если пользователя нет —
 *  возвращает пустой ready-снапшот без запроса. Single-flight: параллельные лоадеры ждут
 *  один промис. ПРОБРАСЫВАЕТ ошибку сети/сервера наружу (ADR 024, «Последствия»): молчаливый
 *  отказ вместо ошибки загрузки — худший исход. */
export function ensurePermissionsReady(): Promise<PermissionSnapshot>

/** Принудительно перечитать (после сохранения СВОИХ прав). Не бросает: при неудаче оставляет
 *  прежний снапшот и резолвится им же. */
export function refreshPermissions(): Promise<PermissionSnapshot>

/** Пометить набор устаревшим. Если он уже был загружен — сразу запускает фоновой перезапрос.
 *  Зовётся из authStore на каждый выпуск access-токена. */
export function invalidatePermissions(): void

/** Сброс в idle/пустой. Зовётся из authStore на logout. */
export function clearPermissions(): void
```

Требование к `getPermissions()`: **референциально стабильный** снапшот (новый объект только
когда данные реально изменились) — иначе `useSyncExternalStore` уходит в бесконечный рендер.
То же правило, что и у `getAuthState()`.

Обработка ошибок внутри стора:

- 401 → `clearPermissions()` и проброс `ApiError` (сессия умерла; `AdminErrorBoundary` покажет
  «Сессия истекла», см. §2.6).
- любая другая ошибка → `status: 'error'`, пустой набор, проброс `ApiError`.

### 1.5. `shared/auth/permissions.ts` — **переписать целиком**

Остаётся единственным местом, отвечающим на вопрос «можно ли». Все функции — **чистые
предикаты без аргумента-состояния**: они читают снапшот стора сами (в отличие от старых, которые
принимали `role`). Причина: резолвленный набор один на сессию, сценария «проверить права другого
пользователя» не существует.

```ts
/** Базовое правило, один в один с §2.3 бэкенда:
 *  allowed = isAdmin || (canView && (action === View || <флаг действия>)) */
export function can(screen: KnownScreenKey, action: PermissionAction): boolean
export function canView(screen: KnownScreenKey): boolean
export function canCreate(screen: KnownScreenKey): boolean
export function canUpdate(screen: KnownScreenKey): boolean
export function canDelete(screen: KnownScreenKey): boolean

/** Виден хотя бы один из ключей — для /admin/catalog (§0.8). */
export function canViewAny(screens: readonly KnownScreenKey[]): boolean

/** Системный Admin. Гейт мета-экранов: /admin/roles, /admin/notifications, override-блок (§0.5). */
export function isAdmin(): boolean

/** Виден хотя бы один экран матрицы (или isAdmin). Гейт корня панели. */
export function hasAnyScreenAccess(): boolean

/** Показывать ли ссылку «Админ-панель» на ПУБЛИЧНОМ сайте. Читает AuthUser.hasPanelAccess
 *  (бит из токена), а не стор: публичный сайт матрицу не грузит (§0.1). */
export function canOpenAdminPanel(user: AuthUser | null | undefined): boolean

/** Без изменений (ADR 011, решение 10 чек-листа): SuperAdmin — не часть матрицы. */
export function canManageAdmins(user: AuthUser | null | undefined): boolean
```

Пока `status !== 'ready'` все матричные предикаты возвращают `false` (deny-by-default). Это не
видно пользователю: лоадеры всегда ждут `ensurePermissionsReady()` до вызова предиката.

**Удаляются:** `canManageTours`, `canPublishTours`, `canArchiveTours`, `canDeleteTours`,
`canFeatureTours`, `canViewCatalog`, `canManageCatalog`, `canManageSettings`, `canManageUsers`,
`canManageCalendar`, `canManageNotifications`.

### 1.6. `shared/auth/usePermissions.ts` — **создать**

Образец — `shared/auth/useAuth.ts` (три строки, `useSyncExternalStore`).

```ts
/** Весь снапшот. Перерисовка только когда набор реально сменился. */
export function usePermissions(): PermissionSnapshot

/** Четыре флага одного экрана, уже с применённым правилом «canView — ворота» и
 *  admin-шорткатом. Мемоизируется по (снапшот, ключ) — снапшот стабилен, значит и результат
 *  стабилен, и его можно класть в зависимости эффектов. */
export function useScreenPermission(screen: KnownScreenKey): ScreenPermission
```

Компоненты используют **только** эти хуки; вызывать `canView(...)` прямо в теле компонента
нельзя — там не будет подписки на изменения (после фоновой инвалидации кнопки не перерисуются).
В лоадерах — наоборот, только функции-предикаты.

### 1.7. `shared/auth/authStore.ts` — **изменить**

1. `decodeAccessToken`: убрать роль из обязательных полей — `role` теперь
   `roleClaim(payload) ?? null`, условие отказа остаётся `!Number.isInteger(id) || id <= 0 ||
   !username || !email`. Причина — §0.7 (иначе кастомная роль = разлогин после F5).
2. Добавить `function panelAccessFromToken(token: string): boolean` рядом с
   `superAdminFromToken` — `is_admin === true` (с той же терпимостью к `"true"`/`1`, что у
   `isSuperAdminClaim`) ИЛИ клейм `perms` — непустая строка.
3. `hasPanelAccess` пишется в тех же **четырёх** write site, что и `isSuperAdmin` (комментарии
   ADR 011 в файле обновить, счётчик write site оставить общим): `login`, `decodeAccessToken`,
   `refreshAccessToken`, `applyUser` (перенос из текущего пользователя).
4. `toAuthUser(model)` — `role: model.role` (теперь nullable); `hasPanelAccess` там **не**
   выставляется (DTO его не несёт), как и `isSuperAdmin`.
5. Врезки в жизненный цикл (импорт `./permissionStore`):
   - `login()` после успешного `setState` → `invalidatePermissions()`;
   - `refreshAccessToken()` после успешного `setState` → `invalidatePermissions()`;
   - `logout()` в `finally` → `clearPermissions()`;
   - ветка «refresh не удался / пользователь не собрался» → `clearPermissions()`.

### 1.8. `shared/auth/index.ts` — **изменить**

- Убрать 11 удалённых предикатов.
- Добавить: `can`, `canView`, `canCreate`, `canUpdate`, `canDelete`, `canViewAny`, `isAdmin`,
  `hasAnyScreenAccess`, `ensurePermissionsReady`, `refreshPermissions`, `getPermissions`,
  `usePermissions`, `useScreenPermission`, `AdminScreen`, `PermissionAction`, `ALL_SCREEN_KEYS`,
  `ALL_PERMISSION_ACTIONS`, `CATALOG_SCREEN_KEYS`.
- Типы: `KnownScreenKey`, `ScreenKey`, `ScreenPermission`, `PermissionSnapshot`,
  `MyPermissionsModel`, `MyScreenPermissionModel`.
- `invalidatePermissions`/`clearPermissions` **не экспортировать** — это внутренняя связка
  `authStore ↔ permissionStore`.

---

## §2. Роутер и гарды (Этап 6)

### 2.1. `features/admin/layout/adminNav.ts` — **создать**

Единственное место связи «ключ экрана → маршрут → подпись → иконка». Сейчас этот список зашит
в `AdminSidebar`; он выносится, потому что его нужен второй потребитель — вычисление посадочного
маршрута.

```ts
export interface AdminNavItem {
  to: string
  /** Пункт виден, если виден ХОТЯ БЫ ОДИН из ключей. Для /admin/catalog — все пять (§0.8). */
  screens?: readonly KnownScreenKey[]
  /** Мета-экран: виден только системному Admin (§0.5). Взаимоисключающе со `screens`. */
  adminOnly?: boolean
  /** Ключ в adminLayoutCopy.nav — подпись НЕ хардкодится (ADR 021). */
  labelKey: keyof ReturnType<typeof adminLayoutCopy>['nav']
  icon: string
  end?: boolean
}

export const adminNavItems: readonly AdminNavItem[]

/** Виден ли пункт текущему пользователю (читает предикаты из shared/auth). */
export function isNavItemVisible(item: AdminNavItem): boolean

/** Первый видимый маршрут в порядке adminNavItems, или null, если не виден ни один.
 *  Используется дашбордом как посадочная страница для роли без dashboard.View. */
export function firstVisibleAdminPath(): string | null
```

Состав `adminNavItems` (порядок = порядок в сайдбаре):

| `to` | `screens` / `adminOnly` | `labelKey` |
| --- | --- | --- |
| `/admin` (`end: true`) | `[Dashboard]` | `dashboard` |
| `/admin/products` | `[Products]` | `products` |
| `/admin/calendar` | `[Calendar]` | `calendar` |
| `/admin/orders` | `[Orders]` | `orders` |
| `/admin/catalog` | `CATALOG_SCREEN_KEYS` | `catalog` |
| `/admin/users` | `[Users]` | `users` |
| `/admin/roles` | `adminOnly: true` | `roles` (новый ключ копии) |
| `/admin/notifications` | `adminOnly: true` | `notifications` |
| `/admin/settings` | `[Settings]` | `settings` |

### 2.2. `features/admin/layout/adminRootLoader.ts` — **изменить**

Форма и семантика двух отказов сохраняются 1:1 (redirect для анонима, `accessDenied` для
залогиненного). Меняется только предикат и появляется ожидание матрицы.

```ts
export async function adminRootLoader({ request }: { request: Request }): Promise<AdminRootData> {
  const state = await ensureAuthReady()
  // …два существующих redirect'а (нет пользователя / forceChangePassword) без изменений…

  // Бросает ApiError при сетевой ошибке → AdminErrorBoundary («Не удалось загрузить», Повторить).
  // Именно бросает, а не деградирует в «нет прав» (ADR 024).
  await ensurePermissionsReady()

  if (!hasAnyScreenAccess()) return { accessDenied: true, user: state.user }
  return { accessDenied: false, user: state.user }
}
```

`AdminRootData` не меняется. `AdminAccessDenied` не меняется.

### 2.3. Гарды в лоадерах — таблица замен

Паттерн сохраняется дословно: `await` готовности → синхронный предикат → `throw redirect('/admin')`.
Меняется только первая и вторая строки.

```ts
// было
await ensureAuthReady()
if (!canManageUsers(getAuthState().user?.role)) throw redirect('/admin')
// стало
await ensurePermissionsReady()
if (!canView(AdminScreen.Users)) throw redirect('/admin')
```

| Файл | Было | Стало |
| --- | --- | --- |
| `dashboard/DashboardPage.tsx` (`dashboardLoader`) | гарда нет | см. врезку ниже |
| `products/ProductsPage.tsx` (`productsLoader`) | гарда нет | `ensurePermissionsReady()`; `if (!canView(Products)) throw redirect('/admin')` |
| `calendar/CalendarPage.tsx` (`calendarLoader`) | `canManageCalendar` | `canView(AdminScreen.Calendar)` |
| `orders/OrdersPage.tsx` (`ordersLoader`) | `canManageCalendar` | `canView(AdminScreen.Orders)` |
| `orders/OrderDetailPage.tsx` (`orderDetailLoader`) | `canManageCalendar` | `canView(AdminScreen.Orders)` |
| `catalog/CatalogPage.tsx` (`catalogLoader`) | `canManageCatalog` | `canViewAny(CATALOG_SCREEN_KEYS)` + условная загрузка (§2.5) |
| `users/UsersPage.tsx` (`usersLoader`) | `canManageUsers` | `canView(AdminScreen.Users)` |
| `users/UserDetailPage.tsx` (`userDetailLoader`) | `canManageUsers` | `canView(AdminScreen.Users)` |
| `settings/SettingsPage.tsx` (`settingsLoader`) | `canManageSettings` | `canView(AdminScreen.Settings)` |
| `notifications/NotificationsPage.tsx` (`notificationsLoader`) | `canManageNotifications` | `isAdmin()` (§0.5) |
| `tour-form/TourCreatePage.tsx` (`tourCreateLoader`) | гарда нет | `if (!canCreate(Products)) throw redirect('/admin/products')` |
| `tour-form/TourEditPage.tsx` (`tourEditLoader`) | гарда нет | `if (!canUpdate(Products)) throw redirect('/admin/products')` |
| `roles/RolesPage.tsx` (`rolesLoader`), `roles/RoleDetailPage.tsx` (`roleDetailLoader`) | — | `if (!isAdmin()) throw redirect('/admin')` |

**Врезка: `dashboardLoader`.** Два изменения.

1. Дашборд может быть не виден (роль без `dashboard.View`), а редирект на `/admin` из индекс-роута
   зациклится. Поэтому:
   ```ts
   await ensurePermissionsReady()
   if (!canView(AdminScreen.Dashboard)) {
     const fallback = firstVisibleAdminPath()
     if (fallback && fallback !== '/admin') throw redirect(fallback)
     return { tours: [] }   // ни одного видимого экрана: корневой лоадер этой же навигации
                            // вернёт accessDenied, AdminLayout не отрендерит <Outlet/>,
                            // эти данные никто не увидит. Бросать нельзя — будет цикл.
   }
   ```
2. Дашборд читает `getAllTours()`, а это `products.View` на бэкенде. Роль с `dashboard.View`, но
   без `products.View` получила бы 403 на главной странице панели. Поэтому запрос выполняется
   только при `canView(AdminScreen.Products)`, иначе `tours: []` (карточки-счётчики покажут нули,
   превью продуктов — пустое состояние, которое уже реализовано).

### 2.4. Кнопки внутри экранов

Правило: экран получает флаги через `useScreenPermission(...)` **один раз в странице-контейнере**
и раздаёт их дочерним компонентам пропсами (`canDelete: boolean`, …). «Глупые» компоненты
(`ProductsTable`, `UsersTable`, вкладки каталога) прав не спрашивают — это уже существующая
конвенция (`UsersTable.canManageAdmins`, `ProductsTable.canDelete`).

| Экран / компонент | Что гейтится | Предикат |
| --- | --- | --- |
| `ProductsPage` | «Создать продукт» (2 места: шапка и пустое состояние) | `canCreate(Products)` |
| `ProductsPage` → `ProductsTable` | «Изменить», publish-тумблер, архив/восстановление | `canUpdate(Products)` |
| `ProductsPage` → `ProductsTable`/`ProductsToolbar` | сердечко «избранное», перестановка, вкладка «Избранные» | `canUpdate(Products)` — §0.3 бэкенда: featured переехал в Update |
| `ProductsPage` → `ProductsTable` | «Удалить окончательно» | `canDelete(Products)` |
| `CalendarPage` → `DayClosureControls`, `BulkClosurePanel` | создание правил закрытия | `canCreate(Calendar)` |
| `CalendarPage` → `ClosureRulesTable`, `DayClosureControls` | удаление правил | `canDelete(Calendar)` |
| `OrdersPage` | создание заказа из панели | `canCreate(Orders)` |
| `OrderDetailPage` → `OrderContextActions`, `OrderHeader` | смена статуса, назначение/снятие исполнителя, отправка клиенту, правка строки | `canUpdate(Orders)` |
| `OrderDetailPage` → `AddLineModal`, `OrderPaymentTab` | добавить строку, добавить платёж | `canCreate(Orders)` |
| `OrderDetailPage` → `OrderLinesGrid` | удалить строку, удалить заказ | `canDelete(Orders)` |
| `CatalogPage` → каждая вкладка | «Добавить» / «Изменить» / «Удалить» | `canCreate/​canUpdate/​canDelete` **своего** ключа вкладки |
| `RegionsTab` | только правка блёрба (Create/Delete не существует) | `canUpdate(CatalogRegions)` |
| `UsersPage` → `UsersTable` → `RoleSelect` | смена роли | `canUpdate(Users)` **и** список ролей загружен (§5) |
| `UserDetailPage` → `UserDangerZone` | сброс пароля | `canUpdate(Users)` |
| `UserDetailPage` → `UserDangerZone` | удаление аккаунта | `canDelete(Users)` (существующие ограничения self/SuperAdmin — сверх этого, не вместо) |
| `UserDetailPage` → `UserDetailInfo` | «роль исполнителя по умолчанию» | `canUpdate(Users)` |
| `SettingsPage` → `SettingsActions` | «Сохранить» | `canUpdate(Settings)` |

Запрещённое действие **дизейблится с подсказкой** (`title`/`aria-describedby`), а не исчезает,
если рядом остаётся видимая информация того же блока (danger zone, тулбары). Полностью прячется
только то, чей единственный смысл — действие (кнопка «Создать»), и целые вкладки/разделы.
Это уже действующая практика (`UserDangerZone.deleteDisabledHint`).

### 2.5. `features/admin/catalog/CatalogPage.tsx` — **изменить**

```ts
export async function catalogLoader() {
  await ensurePermissionsReady()
  if (!canViewAny(CATALOG_SCREEN_KEYS)) throw redirect('/admin')

  const [places, expenseTemplates, noteTemplates, regions, tags] = await Promise.all([
    canView(AdminScreen.CatalogPlaces) ? getPlaces() : Promise.resolve(null),
    canView(AdminScreen.CatalogExpenseTemplates) ? getExpenseTemplates() : Promise.resolve(null),
    canView(AdminScreen.CatalogNoteTemplates) ? getTourNoteTemplates() : Promise.resolve(null),
    canView(AdminScreen.CatalogRegions) ? getRegions() : Promise.resolve(null),
    canView(AdminScreen.CatalogTags) ? getTags() : Promise.resolve(null),
  ])
  return { places, expenseTemplates, noteTemplates, regions, tags }
}
```

`tabs` строится динамически: элемент попадает в массив, только если его список `!== null`.
`activeTab` инициализируется первой доступной вкладкой (`useState(() => tabs[0].id)`), а не
константой `'places'`. `PlacesTab` дополнительно принимает `regions` — если регионы недоступны,
селектор региона в форме точки рендерится как отключённый с подсказкой (не пустой список без
объяснения).

### 2.6. Прочие точки в `layout/`

- `AdminSidebar.tsx` — **изменить**: `navItems` удаляется из файла (переезжает в `adminNav.ts`),
  фильтрация становится `adminNavItems.filter(isNavItemVisible)`, проп `user` остаётся (нижний
  блок аккаунта). Тип `NavItem` и импорт `RoleType` уходят.
- `AdminErrorBoundary.tsx` — **изменить**: добавить ветку `status === 401` в тот же панель-вид,
  что и `SessionExpiredError` (сейчас 401 попадает в «Сервер не ответил», а после появления
  `ensurePermissionsReady` это реальный путь). В ветку 403 добавить второй абзац
  `copy.forbiddenLagHint` (§0.10).
- `adminLayoutCopy.ts` — **изменить**: `nav.roles` (RU «Роли и права» / EN «Roles & permissions»),
  `errorBoundary.forbiddenLagHint`.

### 2.7. Публичная часть

- `app/layout/UserMenu.tsx` — `canOpenAdminPanel(user.role)` → `canOpenAdminPanel(user)`.
- `features/auth/account/AccountPage.tsx` — то же.
- `features/auth/account/components/ProfileSummary.tsx` + `features/auth/lib/roleLabels.ts` —
  `roleLabelKey(user.role)` должен принимать `RoleType | null`; для `null` возвращать новый ключ
  словаря `auth.role.custom` (RU «Сотрудник», EN «Staff»). Публичный `AuthUser` имени кастомной
  роли не знает и знать не должен.
- `shared/i18n/dictionary.ts` — **изменить**: `+ auth.role.custom`.

### 2.8. `app/router.tsx` — **изменить**

Добавить два маршрута в children `admin`, сразу после `users/:id` (порядок в файле = порядок в
навигации):

```tsx
{
  path: 'roles',
  lazy: () => import('@/features/admin').then((m) => ({ Component: m.RolesPage, loader: m.rolesLoader })),
},
{
  path: 'roles/:id',
  lazy: () =>
    import('@/features/admin').then((m) => ({
      Component: m.RoleDetailPage,
      loader: m.roleDetailLoader,
    })),
},
```

`roles/new` отдельным маршрутом **не заводится**: создание — это `/admin/roles/:id` с `id = 'new'`
(лоадер отличает его до `Number(params.id)`), как уже сделано у формы тура через два разных
маршрута, но здесь форма одна и различие сводится к отсутствию загрузки роли. Правило разбора
`params.id` — в §3.3.

---

## §3. Экран управления ролями (Этап 5)

### 3.1. Место в дереве и состав файлов

`src/features/admin/roles/` — новый модуль внутри фичи `admin`, по образцу
`features/admin/notifications/`.

```
features/admin/
  api/adminRoles.ts                     ← создать (api/Roles + api/Screens)
  lib/adminScreensCopy.ts               ← создать (кросс-модульные подписи экранов)
  ui/PermissionMatrix.tsx               ← создать (общий примитив: используют roles И users)
  ui/PermissionCell.tsx                 ← создать (ячейка: чекбокс либо трёхпозиционная)
  types/roles.ts                        ← создать (wire-DTO ролей/экранов/override)
  roles/
    RolesPage.tsx                       ← создать (rolesLoader + список ролей)
    RoleDetailPage.tsx                  ← создать (roleDetailLoader + форма роли)
    components/RolesTable.tsx           ← создать
    components/RoleForm.tsx             ← создать (имя + матрица + действия)
    components/RoleDeleteModal.tsx      ← создать
    hooks/useRoleForm.ts                ← создать (state, baseline, dirty, submit)
    lib/roleModel.ts                    ← создать (чистые функции над матрицей)
    lib/rolesCopy.ts                    ← создать (defineCopy(ru, en))
```

`PermissionMatrix` кладётся в `features/admin/ui/`, а не в `roles/components/`, потому что её
второй потребитель — блок override на карточке пользователя (§4). Это ровно назначение папки
`features/admin/ui/` (там уже живут `SidePanel`, `EmployeeJobRoleSelect`, `TourTableParts`).
`adminScreensCopy` — по той же причине в `features/admin/lib/`, рядом с `adminEnumsCopy.ts`.

### 3.2. Wire-DTO — `features/admin/types/roles.ts` — **создать**

Зеркало §3.2/§4.2 бэкенд-документа. Образец файла — `features/admin/types/notifications.ts`.

```ts
export interface ScreenPermissionModel {
  screenKey: string
  canView: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}

export interface RoleInfoModel {
  id: number
  name: string
  /** null у кастомной роли. */
  type: RoleType | null
  isSystem: boolean
  userCount: number
  /** По всем экранам реестра (бэкенд дозаполняет отсутствующие строки нулями). */
  permissions: ScreenPermissionModel[]
}

export interface RoleSaveModel {
  id?: number | null
  name: string
  permissions: ScreenPermissionModel[]
}

export interface ScreenDefinitionModel {
  key: string
  /** RU-подпись от бэкенда. На фронте используется только как фолбэк (§0.9). */
  displayName: string
  actions: PermissionAction[]
}

export interface ScreenOverrideModel {
  screenKey: string
  canView: boolean | null
  canCreate: boolean | null
  canUpdate: boolean | null
  canDelete: boolean | null
}

export interface UserPermissionOverrideSaveModel {
  userId: number
  overrides: ScreenOverrideModel[]
}
```

### 3.3. API-модуль — `features/admin/api/adminRoles.ts` — **создать**

Образец — `features/admin/api/adminNotifications.ts` (тонкие функции над `authFetch`, шапка-
комментарий про гейтинг эндпоинта).

```ts
/** api/Roles и api/Screens — [Authorize(Roles = Admin)] на контроллерах целиком (§0.5
 *  бэкенд-документа): это мета-экраны системы прав, матрицей они НЕ гейтятся. Зеркалится
 *  на фронте предикатом isAdmin(). */
export function getRoles(): Promise<RoleInfoModel[]>
export function getScreens(): Promise<ScreenDefinitionModel[]>
export function createRole(model: RoleSaveModel): Promise<RoleInfoModel>
export function updateRole(id: number, model: RoleSaveModel): Promise<RoleInfoModel>
export function deleteRole(id: number): Promise<void>
```

`features/admin/api/adminUsers.ts` — **изменить**, добавить:

```ts
/** GET api/Users/{id}/PermissionOverrides — гейтится users.View, но экран показывает блок
 *  только системному Admin (§4.1): редактор override — часть системы прав. */
export function getUserPermissionOverrides(id: number): Promise<ScreenOverrideModel[]>
export function putUserPermissionOverrides(model: UserPermissionOverrideSaveModel): Promise<void>
```

### 3.4. `/admin/roles` — список

```ts
export async function rolesLoader() {
  await ensurePermissionsReady()
  if (!isAdmin()) throw redirect('/admin')
  const roles = await getRoles()
  return { roles }
}
```

`RolesPage`: заголовок + подзаголовок, кнопка «Создать роль» (`<Link to="/admin/roles/new">`),
`RolesTable`.

`RolesTable` props:

```ts
interface RolesTableProps {
  roles: RoleInfoModel[]
  /** Открыть карточку роли. */
  onOpen: (role: RoleInfoModel) => void
  /** Запросить удаление; страница владеет модалкой (одна на страницу — конвенция UsersPage). */
  onRequestDelete: (role: RoleInfoModel) => void
  busyId: number | null
}
```

Колонки: **Название** (+ бейдж «Системная» для `isSystem`), **Тип** (`roleTypeLabel(type)` из
`adminEnumsCopy`/`rolesCopy`, «—» для кастомной), **Пользователей** (`userCount`), **Действия**.

Правила строки:
- `isSystem` → кнопка «Удалить» отключена, подсказка `rolesCopy.deleteSystemHint`;
  открыть карточку можно, но она **read-only** (§3.6).
- `userCount > 0` → «Удалить» отключена, подсказка `rolesCopy.deleteInUseHint(userCount)`.

Мобильная вёрстка: ниже `sm` — список карточек (название крупно, тип и счётчик строкой, действия
в `ActionsMenu`), выше — таблица. Тот же приём, что и в `UsersTable`.

### 3.5. `/admin/roles/:id` — карточка роли

```ts
export async function roleDetailLoader({ params }: LoaderFunctionArgs) {
  await ensurePermissionsReady()
  if (!isAdmin()) throw redirect('/admin')

  const isNew = params.id === 'new'
  const id = isNew ? null : Number(params.id)
  if (!isNew && (!Number.isInteger(id) || id! <= 0)) {
    throw new Response('Некорректный идентификатор роли', { status: 400 })
  }

  // GET api/Roles отдаёт список целиком (ролей единицы) — отдельного GET by id нет.
  const [roles, screens] = await Promise.all([getRoles(), getScreens()])
  const role = isNew ? null : (roles.find((r) => r.id === id) ?? null)
  if (!isNew && role === null) throw new Response('Роль не найдена', { status: 404 })

  return { role, screens, existingNames: roles.map((r) => r.name) }
}
```

`RoleDetailPage` рендерит `<RoleForm key={role?.id ?? 'new'} … />` — ключ по id, чтобы переход
между двумя ролями пересоздавал локальное состояние формы (тот же приём, что в `UserDetailPage`
и `TourEditPage`).

### 3.6. `RoleForm` и `PermissionMatrix`

`RoleForm` props:

```ts
interface RoleFormProps {
  /** null = создание новой роли. */
  role: RoleInfoModel | null
  screens: ScreenDefinitionModel[]
  /** Имена существующих ролей — для валидации дубля до отправки. */
  existingNames: string[]
}
```

Состав: `Field`+`Input` (название) → `PermissionMatrix` → панель действий (Сохранить / Отмена,
счётчик изменений). Read-only режим при `role.isSystem`: поле имени и все ячейки `disabled`,
сверху — баннер `rolesCopy.systemRoleBanner` («Системная роль: её название и права
зафиксированы»). Кнопка «Сохранить» в этом режиме не рендерится.

`features/admin/ui/PermissionMatrix.tsx` — **презентационный** компонент, ничего не грузит и не
сохраняет:

```ts
export type CellValue = boolean | null   // null — только в mode='override' («наследовать»)

export interface PermissionMatrixRow {
  screenKey: string
  /** Уже локализованная подпись (adminScreensCopy с фолбэком на displayName). */
  label: string
  /** Применимые действия из ScreenDefinitionModel.actions. */
  actions: readonly PermissionAction[]
  values: Partial<Record<PermissionAction, CellValue>>
  /** Значение, которое даёт роль — показывается под ячейкой в mode='override'. */
  inherited?: Partial<Record<PermissionAction, boolean>>
  /** Предупреждение под строкой (например, «Create без прав на справочники», §0.8). */
  hint?: string
}

export interface PermissionMatrixProps {
  mode: 'role' | 'override'
  rows: PermissionMatrixRow[]
  onChange: (screenKey: string, action: PermissionAction, value: CellValue) => void
  disabled?: boolean
  /** <caption> таблицы — обязательна, экран читается скринридером. */
  caption: string
}
```

Рендер:

- **≥ `sm`** — настоящая `<table>`: первая колонка «Экран», далее 4 колонки
  (Просмотр / Создание / Изменение / Удаление). Неприменимое действие — ячейка с `—`
  (`adminCommonCopy.dash`), без контрола. Заголовок таблицы `sticky top-0`.
- **< `sm`** — список карточек: имя экрана заголовком, применимые действия — вертикальный
  список контролов с видимыми подписями. Горизонтальный скролл таблицы на телефоне не
  используется (agents.md: мобильная версия обязана работать полноценно, а не «пролистываться»).

`features/admin/ui/PermissionCell.tsx`:
- `mode='role'` → `Checkbox` из `shared/ui` с **скрытой** подписью;
- `mode='override'` → трёхпозиционный контрол: `<button role="checkbox" aria-checked={true |
  false | 'mixed'}>`, клик циклит «наследовать → разрешить → запретить → наследовать».
  Визуально: mixed — пунктирная серая рамка с «–», allow — тёмная заливка с галочкой, deny —
  светлая с «✕» и rose-рамкой. Подпись состояния — в `aria-label`, не только цветом.

`shared/ui/Checkbox.tsx` — **изменить**: добавить проп `labelHidden?: boolean`; при `true` видимый
`<span>` заменяется на `sr-only`. Ассоциация `label ↔ input` сохраняется, поэтому доступное имя
у ячейки остаётся. Аддитивно, существующие вызовы не трогаются.

`lib/roleModel.ts` — чистые функции, тестируемые без React:

```ts
/** DTO + реестр → строки матрицы (порядок = порядок screens, подписи из adminScreensCopy). */
export function buildRoleMatrixRows(
  role: RoleInfoModel | null,
  screens: ScreenDefinitionModel[],
  labels: Record<string, string>,
): PermissionMatrixRow[]

/** Правило-ворота, зеркало §2.3 бэкенда: снятие View гасит Create/Update/Delete этой строки. */
export function applyCellChange(
  rows: PermissionMatrixRow[],
  screenKey: string,
  action: PermissionAction,
  value: CellValue,
): PermissionMatrixRow[]

/** Строки → payload. Неприменимые действия форсятся в false (бэкенд делает то же, §3.1). */
export function rowsToPermissions(rows: PermissionMatrixRow[]): ScreenPermissionModel[]

export function isMatrixDirty(a: ScreenPermissionModel[], b: ScreenPermissionModel[]): boolean

/** Предупреждение §0.8: products.Create|Update выданы, но не все CATALOG_SCREEN_KEYS видны. */
export function catalogDependencyHint(rows: PermissionMatrixRow[], copy: RolesCopy): string | undefined
```

### 3.7. `useRoleForm` — состояние, dirty, сохранение

Образец — `useSettingsForm` (state + baseline, без редьюсера).

```ts
export interface UseRoleFormResult {
  name: string
  setName: (value: string) => void
  rows: PermissionMatrixRow[]
  setCell: (screenKey: string, action: PermissionAction, value: CellValue) => void
  isDirty: boolean
  /** Ошибка имени, показывается после первой попытки сохранить. */
  nameError: string | null
  canSubmit: boolean
  submit: () => void
  isSubmitting: boolean
  error: string | null
  /** Показать подсказку «права применятся в течение 15 минут» (§0.10) после успешного save. */
  showLagHint: boolean
}
```

Поведение:

- **Создание** — `createRole`, при успехе `navigate('/admin/roles/' + created.id, { replace: true })`
  и baseline = ответ сервера.
- **Изменение** — `updateRole`, baseline = ответ.
- Если сохранённая роль — **роль текущего пользователя** (сравнение по `role.id` с ролью актора
  недоступно на фронте напрямую: `AuthUser` не несёт `roleId`) — поэтому проще и надёжнее:
  **всегда** звать `refreshPermissions()` после успешного сохранения роли или override. Один
  лишний GET на действие администратора — приемлемая цена за отсутствие класса багов «сам себя
  урезал, а панель не перерисовалась».
- Валидация имени до отправки: непустое после `trim`, не длиннее 256, не совпадает с
  `existingNames` (без учёта регистра, исключая собственное текущее имя). Иначе — `nameError`,
  запрос не уходит.
- Уход со страницы с `isDirty` → `UnsavedChangesModal` из `shared/ui`.

Коды ошибок бэкенда → сообщения (`rolesCopy.errorMessage(err, action)`, форма функции — как
`notificationsErrorMessage`): `2031 RoleIsSystem` → «Системную роль нельзя изменить или удалить»;
`2032 RoleInUse` → «Роль назначена пользователям (N) — сначала переназначьте их»;
`2033 UnknownScreenKey` → «Список экранов устарел — обновите страницу»;
`2034 RoleNameInvalid` → «Название роли пустое или уже занято»;
`2206 RoleNotFound` → «Роль не найдена — возможно, её удалили»; 403 → `rolesCopy.permissionLag`.

### 3.8. Состояния и edge-кейсы экрана ролей

| Ситуация | Поведение |
| --- | --- |
| Загрузка списка/карточки | Стандартная: лоадер держит навигацию, спиннера нет (конвенция всех админ-экранов) |
| Ошибка загрузки | Не ловится — `AdminErrorBoundary` |
| Ролей ровно 4 (только системные) | Таблица показывается как есть; пустого состояния не существует — системные роли есть всегда |
| Роль без единой галочки | Валидна и сохраняется: «роль без доступа» — законная конфигурация |
| Роль с `userCount > 0` | Удаление заблокировано в UI + 409 с бэкенда как страховка |
| Системная роль | Карточка read-only; удаление заблокировано |
| Незнакомый ключ из `GET api/Screens` | Строка рисуется, подпись — `displayName` с бэкенда (§0.9) |
| Ключ, которого нет в ответе `GET api/Screens`, но есть в `role.permissions` | Игнорируется (реестр — источник истины, как и на бэкенде) |
| Сохранение в полёте | Все контролы `disabled`, кнопка показывает `adminCommonCopy.saving` |
| Админ урезал права своей роли | После сохранения `refreshPermissions()` → сайдбар и кнопки перерисовываются немедленно; подсказка про 15 минут для серверного применения |

---

## §4. Персональные override на `/admin/users/:id` (Этап 5.5)

### 4.1. Где встраивается

`UserDetailPage` рендерит новый блок **между** `UserDetailInfo` и `LoginHistoryList`: override —
это настройка аккаунта, а история входов — справочный контекст перед danger zone.

Блок виден **только при `isAdmin()`** (§0.5): редактирование override — управление системой прав,
а `GET api/Screens` на бэкенде Admin-only. Для не-Admin с `users.View` блок просто отсутствует.

`userDetailLoader` — **изменить**:

```ts
const canEditPermissions = isAdmin()
const [user, loginHistory, overrides, screens, roles] = await Promise.all([
  getUserDetail(id),
  getUserLoginHistory(id).catch(() => null),
  canEditPermissions ? getUserPermissionOverrides(id).catch(() => null) : Promise.resolve(null),
  canEditPermissions ? getScreens().catch(() => null) : Promise.resolve(null),
  canEditPermissions ? getRoles().catch(() => null) : Promise.resolve(null),
])
```

`roles` нужен, чтобы показать базовую матрицу роли под каждой ячейкой («по роли: разрешено») —
без неё трёхпозиционный контрол непонятен. Все три запроса ловятся: сбой мета-эндпоинта не должен
уносить карточку пользователя (тот же контракт, что у `loginHistory`).

### 4.2. Компонент

`features/admin/users/components/UserPermissionsCard.tsx` — **создать**.

```ts
interface UserPermissionsCardProps {
  userId: number
  /** Имя роли — для строки «наследует от роли «X»». */
  roleName: string
  /** Матрица роли пользователя; null — не удалось загрузить. */
  rolePermissions: ScreenPermissionModel[] | null
  overrides: ScreenOverrideModel[] | null
  screens: ScreenDefinitionModel[] | null
  /** Ограничение сверху: без users.Update блок только читается. */
  canEdit: boolean
  onSaved: () => void
}
```

Поведение:

- Свёрнут по умолчанию (`<details>`-подобный контейнер на `Card`), заголовок «Персональные
  права», сводка справа: `rolesCopy.overrideSummary(count)` — «Наследует все права роли «X»» при
  `count === 0`, иначе «N переопределений».
- Раскрытый — `PermissionMatrix mode="override"` с `inherited` из `rolePermissions`.
- «Сохранить» шлёт `putUserPermissionOverrides({ userId, overrides })`, где в `overrides`
  попадают **только строки, где хоть один флаг не `null`**; строка со всеми `null` не
  отправляется (бэкенд трактует отсутствие/пустоту как «удалить override», §3.1).
- Кнопка «Сбросить все переопределения» — ставит всю матрицу в `null`, помечает форму dirty;
  фактическое снятие происходит по «Сохранить».
- После успеха — `onSaved()` (страница делает `revalidator.revalidate()`) и
  `refreshPermissions()` (админ мог переопределить сам себя).
- Любой из `rolePermissions`/`screens`/`overrides` равен `null` → блок рендерит строку ошибки
  «Не удалось загрузить права» + «Повторить» (перезагрузка страницы), без матрицы.

Мобильная адаптивность — та же, что у матрицы роли (§3.6): карточки вместо таблицы.

---

## §5. Кастомные роли в существующем разделе «Пользователи»

Без этих правок кастомную роль **невозможно назначить**, а подписи ролей в списке сломаются на
`role = null`.

- `features/admin/users/lib/userCopy.ts` — **изменить**: удалить `roleIdFor` (id роли больше не
  выводится из списка пользователей — он приходит из `GET api/Roles`), удалить `roleHints`
  (жёстко зашитые описания четырёх ролей — ложь при кастомных), `buildRoleOptions` переписать
  под `RoleInfoModel[]`. `roleLabels: Record<RoleType, string>` **остаётся** — им подписываются
  системные роли там, где известен именно `RoleType` (фильтры, `PromoteToAdminModal`).
- `features/admin/users/components/RoleSelect.tsx` — **изменить**: `value: number` (roleId),
  `roles: RoleInfoModel[] | null`, `onChange: (roleId: number, role: RoleInfoModel) => void`.
  При `roles === null` (не-Admin) рендерится статичный текст `user.roleName` вместо `Select`.
  `allowAdminOption` остаётся и означает «показывать роли с `type === RoleType.Admin`».
- `features/admin/users/UsersPage.tsx` — **изменить**: `usersLoader` дополнительно грузит
  `isAdmin() ? getRoles().catch(() => null) : null`; секция «Что даёт роль» заменяется на одну
  строку со ссылкой на `/admin/roles` (для Admin) — описания прав теперь редактируемые данные,
  дублировать их текстом нельзя. `handleChangeRole` шлёт `roleId` напрямую.
  `PromoteToAdminModal` вызывается, когда у выбранной роли `type === RoleType.Admin`.
- `features/admin/users/components/UsersTable.tsx` — **изменить**: колонка роли —
  `user.roleName`; `isTargetAdmin` остаётся `user.role === RoleType.Admin` (системный Admin
  сохраняет `Type`); `RoleSelect` получает `roles`.
- `features/admin/users/components/UsersToolbar.tsx` + `lib/filterUsers.ts` — **изменить**:
  фильтр по роли переходит с `RoleType` на `roleId`, опции строятся из `roles`; при
  `roles === null` фильтр не рендерится.
- `features/admin/users/components/UserDetailInfo.tsx` — **изменить**: `roleLabels[user.role]`
  → `user.roleName`. Условие показа «роли исполнителя» остаётся `user.role === RoleType.Employee`.
- `features/admin/api/adminOrders.ts` (`user.role === RoleType.Employee` при выборе исполнителей)
  — **не трогать**: Employee остаётся системной ролью (решение 9 чек-листа).

---

## §6. Как добавить новый экран ПОСЛЕ этой задачи (фронтовая половина §5 бэкенд-документа)

Бэкенд гарантирует, что новый экран — это одна запись в `AdminScreens.All` плюс атрибуты на
контроллере. На фронте это ровно четыре аддитивные правки, ни одна из которых не трогает ядро:

1. `shared/auth/screens.ts` — константа ключа в `AdminScreen` (нужна только для типобезопасности
   вызовов).
2. `features/admin/lib/adminScreensCopy.ts` — RU/EN подпись. **Необязательно**: без неё матрица
   покажет `displayName` с бэкенда.
3. `features/admin/layout/adminNav.ts` — одна запись (маршрут, ключ, иконка, ключ подписи).
   Сайдбар и посадочный маршрут подхватывают её автоматически.
4. `app/router.tsx` + лоадер нового экрана с `await ensurePermissionsReady()` и
   `canView(AdminScreen.X)`.

**Что менять НЕ нужно:** `permissionStore`, `permissions.ts`, `usePermissions`, `PermissionMatrix`,
редактор роли, блок override, `MyPermissions`-контракт. Они итерируют по данным с бэкенда, а не
по локальному списку экранов.

Переименование экрана — правка одной строки в `adminScreensCopy` (ключ не трогать: к нему привязаны
строки прав в БД). Удаление экрана — снять запись из `adminNav.ts`, маршрут и константу; осиротевшие
данные бэкенд игнорирует сам.

---

## §7. Сводка «что создать / что изменить»

### shared/auth
- **создать** `screens.ts`, `permissionsApi.ts`, `permissionStore.ts`, `usePermissions.ts`
- **переписать** `permissions.ts` (универсальные предикаты; из старого остаются только
  `canManageAdmins` и `canOpenAdminPanel` в новой форме)
- **изменить** `types.ts` (`MyPermissionsModel`/`MyScreenPermissionModel`; `AuthUser.role` →
  nullable, `+hasPanelAccess`; `UserInfoModel`/`UserDetailInfoModel`: `role` → nullable,
  `+roleName`)
- **изменить** `authStore.ts` (терпимый к отсутствию роли декод, `panelAccessFromToken`,
  врезки `invalidatePermissions`/`clearPermissions`)
- **изменить** `index.ts` (новая публичная поверхность)

### shared (прочее)
- **изменить** `shared/ui/Checkbox.tsx` (`labelHidden?: boolean`)
- **изменить** `shared/i18n/dictionary.ts` (`+auth.role.custom`)

### app
- **изменить** `app/router.tsx` (маршруты `roles`, `roles/:id`)
- **изменить** `app/layout/UserMenu.tsx` (`canOpenAdminPanel(user)`)

### features/auth
- **изменить** `features/auth/account/AccountPage.tsx`, `account/components/ProfileSummary.tsx`,
  `lib/roleLabels.ts` (nullable-роль)

### features/admin — ядро панели
- **создать** `layout/adminNav.ts`
- **изменить** `layout/adminRootLoader.ts`, `layout/AdminSidebar.tsx`,
  `layout/AdminErrorBoundary.tsx`, `layout/adminLayoutCopy.ts`
- **изменить** `index.ts` (экспорт `RolesPage`/`rolesLoader`/`RoleDetailPage`/`roleDetailLoader`)

### features/admin — новый модуль ролей
- **создать** `api/adminRoles.ts`, `types/roles.ts`, `lib/adminScreensCopy.ts`,
  `ui/PermissionMatrix.tsx`, `ui/PermissionCell.tsx`
- **создать** `roles/RolesPage.tsx`, `roles/RoleDetailPage.tsx`, `roles/components/RolesTable.tsx`,
  `roles/components/RoleForm.tsx`, `roles/components/RoleDeleteModal.tsx`,
  `roles/hooks/useRoleForm.ts`, `roles/lib/roleModel.ts`, `roles/lib/rolesCopy.ts`

### features/admin — замена гардов (Этап 6)
- **изменить** лоадеры: `dashboard/DashboardPage.tsx`, `products/ProductsPage.tsx`,
  `calendar/CalendarPage.tsx`, `orders/OrdersPage.tsx`, `orders/OrderDetailPage.tsx`,
  `catalog/CatalogPage.tsx`, `users/UsersPage.tsx`, `users/UserDetailPage.tsx`,
  `settings/SettingsPage.tsx`, `notifications/NotificationsPage.tsx`,
  `tour-form/TourCreatePage.tsx`, `tour-form/TourEditPage.tsx`
- **изменить** кнопки/пропсы по таблице §2.4: `products/components/ProductsTable.tsx`,
  `products/components/ProductsToolbar.tsx`, `calendar/components/DayClosureControls.tsx`,
  `calendar/components/BulkClosurePanel.tsx`, `calendar/components/ClosureRulesTable.tsx`,
  `orders/components/OrderContextActions.tsx`, `orders/components/OrderHeader.tsx`,
  `orders/components/OrderLinesGrid.tsx`, `orders/components/OrderPaymentTab.tsx`,
  `orders/components/AddLineModal.tsx`, `catalog/*/`(пять вкладок),
  `settings/components/SettingsActions.tsx`, `users/components/UserDangerZone.tsx`
- **изменить** под кастомные роли (§5): `users/lib/userCopy.ts`, `users/lib/filterUsers.ts`,
  `users/components/RoleSelect.tsx`, `users/components/UsersTable.tsx`,
  `users/components/UsersToolbar.tsx`, `users/components/UserDetailInfo.tsx`
- **создать** `users/components/UserPermissionsCard.tsx`
- **изменить** `api/adminUsers.ts` (два override-эндпоинта; шапки-комментарии про гейтинг),
  `api/adminCatalog.ts`, `api/adminAvailability.ts`, `api/adminOrders.ts` (в шапках заменить
  упоминания `canManageX` на актуальные ключи — это документация контракта, она не должна врать)

### docs
- **создать** [ADR 024](adr/024-frontend-permissions-from-mypermissions-endpoint.md) (готово)
- **изменить** после реализации: `docs/admin-panel.md` (раздел про роли и права),
  `docs/backend-api.md` (эндпоинты), `docs/CHANGELOG.md` — Этап 8 чек-листа

---

## §8. Порядок выполнения

Разбито так, чтобы каждый кусок собирался и был проверяем отдельно.

1. **Ядро прав** (§1) — `frontend-developer`. Без него не компилируется ничего дальше.
   Критерий готовности: `npm run build` проходит, `permissions.ts` не экспортирует старых имён,
   `/admin` открывается системным Admin.
2. **Гарды и навигация** (§2) — `frontend-developer`. Критерий: все 4 системные роли ведут себя
   как до миграции (сверка с таблицей сида §1.5 бэкенд-документа).
3. **Кастомные роли в «Пользователях»** (§5) — `frontend-developer`. Критерий: кастомную роль
   можно назначить и увидеть её имя в списке.
4. **`PermissionMatrix` + `PermissionCell` + `Checkbox.labelHidden`** (§3.6) — `ui-ux-engineer`.
   Критерий: оба режима и обе вёрстки (таблица/карточки) работают, доступны с клавиатуры,
   состояние читается скринридером.
5. **Экран ролей** (§3) — `frontend-developer`.
6. **Блок override** (§4) — `frontend-developer`.
7. **QA** (Этап 7) — `tester`, включая обязательную проверку мобильной ширины `/admin/roles`
   и `/admin/users/:id`.

Дизайн-мокап (`designer`) для этой задачи **не запрашивается**: это внутренний служебный экран
на существующих примитивах (`Card`/`Tabs`/`Checkbox`/таблица), как «Настройки уведомлений».
Визуальные решения — §3.4/§3.6 этого документа.

---

## §9. Явно вне скоупа

- **12-й ключ прав для `/admin/roles`** (п. 5.2 чек-листа) — отменён в пользу `isAdmin()`, §0.5.
- **Мгновенный форс-релогин** при смене прав — механизм есть на бэкенде, но не подключается
  (§0.2 бэкенд-документа). Фронт компенсирует подсказкой про 15 минут (§0.10).
- **Роль Employee** и её экраны — решение 9 чек-листа, не трогаем.
- **`canManageAdmins`/SuperAdmin** — решение 10, не трогаем.
- **Деградация формы тура при отсутствии прав на справочники** — сознательно не делаем, вместо
  неё предупреждение в матрице (§0.8).
- **Перевод остальных админ-модулей на `defineCopy`** (Spec 009) — идёт параллельно; здесь
  новые файлы сразу пишутся по ADR 021, существующие `*Copy.ts` не мигрируются в рамках этой
  задачи. При конфликте с ветками Spec 009 приоритет у Spec 009 в её файлах.
- **Тесты** (Этап 7) — зона `tester`.
