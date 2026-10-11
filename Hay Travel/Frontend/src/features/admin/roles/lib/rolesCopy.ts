/**
 * Copy and error mapping for «Роли и права» — the role editor and the per-user override block on
 * the user card (both render the same matrix, so both read this module).
 *
 * Follows ADR 021 like every other admin module: `defineCopy(ru, en)`, read through `useCopy` in
 * components and passed in explicitly to the pure helpers that run outside React.
 */

import { ApiError } from '@/shared/lib/http'
import { defineCopy } from '@/shared/i18n/defineCopy'
import { RoleType } from '@/shared/auth'

/* `GlobalErrorCode` values these endpoints can report (backend architecture §3.5, renumbered
 * 2026-08-22 — 2031/2032 collided with the checkout-cart codes added in parallel, see
 * `GlobalErrorCode.cs`). Local constants, mirroring `notificationsCopy.ts` — the panel keeps no
 * shared numeric dictionary. `ROLE_IS_SYSTEM` is gone: no role is exempt from being renamed,
 * re-permissioned or deleted any more (решение Давида 2026-08-22). */
const ROLE_IN_USE = 2034
const UNKNOWN_SCREEN_KEY = 2035
const ROLE_NAME_INVALID = 2036
/* spec 014 §5 — a level the screen does not support (e.g. Update on catalog.regions). The editor
 * never offers one, so this can only mean the screen registry changed under an open page. */
const INVALID_PERMISSION_LEVEL = 2037
const ROLE_NOT_FOUND = 2206
/* AuthErrors block — shared with `ChangeRole`/`DeleteUser` (D3/D4). Reused here for the one
 * SuperAdmin-only field on a role, `CanManageAdmins`. */
const SUPER_ADMIN_PRIVILEGE_REQUIRED = 2216

const ru = {
  title: 'Роли и права',
  subtitle:
    'Кто и что видит в панели. У каждого экрана один уровень доступа: нет доступа, просмотр, ' +
    'создание, изменение или удаление.',
  create: 'Создать роль',
  newRoleTitle: 'Новая роль',

  columnName: 'Название',
  columnType: 'Тип',
  columnUsers: 'Пользователей',
  columnActions: 'Действия',
  customType: '—',
  rowActionsLabel: (name: string) => `Действия с ролью «${name}»`,

  /** The four BUILT-IN tiers. A custom role has no `type` and shows `customType` instead — this map
   * is only ever indexed by a non-null `RoleInfoModel.type`. */
  roleTypeLabels: {
    [RoleType.Regular]: 'Пользователь',
    [RoleType.TourManager]: 'Тур-менеджер',
    [RoleType.Admin]: 'Администратор',
    [RoleType.Employee]: 'Исполнитель',
  } as Record<RoleType, string>,

  open: 'Открыть',
  delete: 'Удалить',
  cancel: 'Отмена',
  save: 'Сохранить',
  saving: 'Сохраняем…',
  deleting: 'Удаляем…',
  /** Accessible name of the detail screen's breadcrumb `<nav>` (Template A's header contract).
   * Replaced the standalone «← К списку ролей» link, which the breadcrumb now is. */
  breadcrumbAria: 'Хлебные крошки',

  nameLabel: 'Название роли',
  nameHint: 'Видно только в панели — например «Менеджер заказов».',
  matrixCaption: 'Права роли по экранам админки',
  /** Единственное место, где объясняется лестница уровней — в самих подписях уровней этого нет,
   * иначе каждый пункт списка читался бы абзацем. */
  matrixLevelExplain:
    'Уровень включает всё, что ниже него: «Изменение» разрешает и просмотр, и создание. ' +
    'Если у экрана какого-то действия нет, оно и не предлагается.',
  unsavedChanges: 'Есть несохранённые изменения',
  /** Тултип недоступной кнопки тулбара карточки роли — та же формулировка, что у заказа. */
  noPermissionHint: 'Недостаточно прав',

  canManageAdminsLabel: 'Может управлять другими администраторами',
  canManageAdminsHint:
    'Позволяет назначать/снимать эту же способность у других ролей и удалять/понижать ' +
    'учётные записи, у которых она стоит. Менять это поле может только SuperAdmin.',
  canManageAdminsLocked: 'Изменить может только SuperAdmin',

  canImpersonateLabel: 'Может входить в аккаунты пользователей',
  canImpersonateHint:
    'Разрешает кнопку «Войти как пользователь» в карточке пользователя. Свой сеанс при этом ' +
    'завершается — вернуться в свою учётную запись можно только повторным входом. Менять это ' +
    'поле может только SuperAdmin.',

  deleteInUseHint: (count: number) =>
    `Роль назначена пользователям (${count}) — сначала переназначьте их`,
  deleteTitle: (name: string) => `Удалить роль «${name}»?`,
  deleteBody:
    'Роль будет удалена безвозвратно вместе со своей матрицей прав. Пользователей на ней быть ' +
    'не должно.',

  /** Shown once after a successful save — see the flexible-roles architecture §0.10. */
  permissionLag:
    'Права сохранены. В панели они применились сразу; на стороне сервера — в течение 15 минут ' +
    'или сразу после того, как пользователь войдёт заново.',

  nameEmpty: 'Введите название роли.',
  nameTooLong: 'Название не длиннее 256 символов.',
  nameTaken: 'Роль с таким названием уже есть.',

  /** §0.8: a role that may create/edit tours but cannot read the catalogs gets a 403 on the form
   * itself. Better to warn where the permission is being granted than to degrade the form later. */
  catalogDependencyHint:
    'Создание и изменение туров требует просмотра всех справочников — иначе форма тура не откроется.',

  overrideTitle: 'Персональные права',
  overrideSummary: (count: number, roleName: string) =>
    count === 0 ? `Наследует все права роли «${roleName}»` : `Переопределений: ${count}`,
  overrideExplain:
    'Персональные права перекрывают роль только там, где вы их задали. Пустая ячейка — ' +
    'наследовать от роли.',
  overrideReset: 'Сбросить все переопределения',
  overrideLoadFailed: 'Не удалось загрузить права пользователя.',
  overrideCaption: (roleName: string) => `Персональные права поверх роли «${roleName}»`,
  retry: 'Повторить',
  expand: 'Развернуть',
  collapse: 'Свернуть',

  /** What the admin was trying to do — substituted into the error sentences below. */
  errorActions: {
    createRole: 'создать роль',
    saveRole: 'сохранить роль',
    deleteRole: 'удалить роль',
    saveOverrides: 'сохранить персональные права',
  },
  errorRoleInUse: 'Роль назначена пользователям — сначала переназначьте их на другую роль.',
  errorSuperAdminRequired:
    'Только SuperAdmin может изменить права «управляет администраторами» и «входит в аккаунты».',
  errorUnknownScreenKey: 'Список экранов устарел — обновите страницу и попробуйте ещё раз.',
  errorInvalidPermissionLevel:
    'Такой уровень доступа к этому экрану неприменим — обновите страницу и попробуйте ещё раз.',
  errorRoleNameInvalid: 'Название роли пустое или уже занято.',
  errorRoleNotFound: 'Роль не найдена — возможно, её удалили.',
  /** Never rendered as such — `AdminErrorBoundary` shows its own message for a thrown `Response` —
   * but the loader still throws a human-readable body, so it belongs here like any other string. */
  errorInvalidId: 'Некорректный идентификатор роли',
  errorNotFound: 'Роль не найдена',
  errorServer: (action: string, status: number) =>
    `Не удалось ${action}: сервер вернул ошибку (${status}).`,
  errorNetwork: (action: string) =>
    `Не удалось ${action}: проверьте соединение и попробуйте ещё раз.`,
}

const en: { [K in keyof typeof ru]: (typeof ru)[K] } = {
  title: 'Roles & permissions',
  subtitle:
    'Who sees what in the panel. Each screen gets one access level: no access, view, create, ' +
    'update or delete.',
  create: 'Create a role',
  newRoleTitle: 'New role',

  columnName: 'Name',
  columnType: 'Type',
  columnUsers: 'Users',
  columnActions: 'Actions',
  customType: '—',
  rowActionsLabel: (name: string) => `Actions for the “${name}” role`,

  roleTypeLabels: {
    [RoleType.Regular]: 'User',
    [RoleType.TourManager]: 'Tour manager',
    [RoleType.Admin]: 'Administrator',
    [RoleType.Employee]: 'Employee',
  },

  open: 'Open',
  delete: 'Delete',
  cancel: 'Cancel',
  save: 'Save',
  saving: 'Saving…',
  deleting: 'Deleting…',
  breadcrumbAria: 'Breadcrumbs',

  nameLabel: 'Role name',
  nameHint: 'Visible in the panel only — for example “Order manager”.',
  matrixCaption: 'Role permissions per admin screen',
  matrixLevelExplain:
    'A level includes everything below it: “Update” also allows viewing and creating. Actions a ' +
    'screen does not have are simply not offered.',
  unsavedChanges: 'You have unsaved changes',
  noPermissionHint: 'Not enough permissions',

  canManageAdminsLabel: 'Can manage other administrators',
  canManageAdminsHint:
    'Lets this role grant/revoke the same ability on other roles, and delete or demote accounts ' +
    'that hold it. Only SuperAdmin can change this field.',
  canManageAdminsLocked: 'Only SuperAdmin can change this',

  canImpersonateLabel: 'Can sign in as other users',
  canImpersonateHint:
    'Enables the “Sign in as user” button on a user’s profile. Doing so ends the actor’s own ' +
    'session — returning to their own account requires signing in again. Only SuperAdmin can ' +
    'change this field.',

  deleteInUseHint: (count: number) =>
    `The role is assigned to ${count} account(s) — reassign them first`,
  deleteTitle: (name: string) => `Delete the “${name}” role?`,
  deleteBody:
    'The role and its permission matrix will be deleted permanently. No account may be on it.',

  permissionLag:
    'Permissions saved. They applied to the panel immediately; on the server side they take ' +
    'effect within 15 minutes, or as soon as the user signs in again.',

  nameEmpty: 'Enter a role name.',
  nameTooLong: 'The name must be at most 256 characters.',
  nameTaken: 'A role with this name already exists.',

  catalogDependencyHint:
    'Creating and editing tours requires view access to every reference list — otherwise the ' +
    'tour form will not open.',

  overrideTitle: 'Personal permissions',
  overrideSummary: (count: number, roleName: string) =>
    count === 0 ? `Inherits everything from the “${roleName}” role` : `Overrides: ${count}`,
  overrideExplain:
    'Personal permissions override the role only where you set them. An empty cell means ' +
    '“inherit from the role”.',
  overrideReset: 'Reset all overrides',
  overrideLoadFailed: 'Could not load this account’s permissions.',
  overrideCaption: (roleName: string) => `Personal permissions on top of the “${roleName}” role`,
  retry: 'Retry',
  expand: 'Expand',
  collapse: 'Collapse',

  errorActions: {
    createRole: 'create the role',
    saveRole: 'save the role',
    deleteRole: 'delete the role',
    saveOverrides: 'save the personal permissions',
  },
  errorRoleInUse: 'The role is assigned to accounts — reassign them to another role first.',
  errorSuperAdminRequired:
    'Only SuperAdmin can change the “manages administrators” and “signs in as users” rights.',
  errorUnknownScreenKey: 'The screen list is out of date — reload the page and try again.',
  errorInvalidPermissionLevel:
    'That access level does not apply to this screen — reload the page and try again.',
  errorRoleNameInvalid: 'The role name is empty or already taken.',
  errorRoleNotFound: 'The role was not found — it may have been deleted.',
  errorInvalidId: 'Invalid role identifier',
  errorNotFound: 'Role not found',
  errorServer: (action: string, status: number) =>
    `Could not ${action}: the server returned an error (${status}).`,
  errorNetwork: (action: string) => `Could not ${action}: check your connection and try again.`,
}

export const rolesCopy = defineCopy(ru, en)
export type RolesCopy = ReturnType<typeof rolesCopy>

function errorCodeOf(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const record = body as Record<string, unknown>
  const raw = record.errorCode ?? record.ErrorCode
  return typeof raw === 'number' ? raw : undefined
}

/**
 * Pure — the caller resolves `copy` against the current locale and passes it in.
 *
 * `action` is an infinitive fragment from `copy.errorActions`, never a literal.
 *
 * 403 maps to the LAG note rather than to a flat "недостаточно прав": the backend enforces the
 * matrix baked into the access token, so the most likely reason an administrator sees it here is
 * that their own rights were widened minutes ago and the token has not rotated yet (§0.10).
 */
export function rolesErrorMessage(copy: RolesCopy, err: unknown, action: string): string {
  if (err instanceof ApiError) {
    switch (errorCodeOf(err.body)) {
      case ROLE_IN_USE:
        return copy.errorRoleInUse
      case UNKNOWN_SCREEN_KEY:
        return copy.errorUnknownScreenKey
      case INVALID_PERMISSION_LEVEL:
        return copy.errorInvalidPermissionLevel
      case ROLE_NAME_INVALID:
        return copy.errorRoleNameInvalid
      case ROLE_NOT_FOUND:
        return copy.errorRoleNotFound
      case SUPER_ADMIN_PRIVILEGE_REQUIRED:
        return copy.errorSuperAdminRequired
      default:
        break
    }
    if (err.status === 403) return copy.permissionLag
    return copy.errorServer(action, err.status)
  }
  return copy.errorNetwork(action)
}
