/**
 * Russian copy and error mapping for the Пользователи screen. The admin panel is Russian-only by
 * design (`Hay Travel/CLAUDE.md`), so this mirrors `catalog/lib/catalogErrors.ts` rather than
 * going through the public site's dictionary.
 */

import { ApiError } from '@/shared/lib/http'
import { RoleType, type UserInfoModel } from '@/shared/auth'
import type { SelectOption } from '@/shared/ui'

/** `GlobalErrorCode` values this screen's mutations can report — the admin panel keeps its own
 * local copy of the numeric codes it cares about rather than a shared dictionary (mirrors
 * `catalogErrors.ts`/`ProductsPage.tsx`'s own `errorCodeOf`, the established pattern here; the
 * i18n `AuthErrorCode` in `shared/auth` is for the public site's login/register forms only). */
const ADMIN_ROLE_IMMUTABLE = 2214 // ChangeRole (B6) — target's current role is Admin.
const CANNOT_DELETE_SELF = 2212 // Delete (B4).
const ACCOUNT_DELETED = 2213 // Delete (B4) — target was already soft-deleted (stale page).
const ADMIN_ACCOUNT_IMMUTABLE = 2215 // Delete — target's role is Admin (mirrors ADMIN_ROLE_IMMUTABLE).
const SUPER_ADMIN_REQUIRED = 2216 // ChangeRole/Delete (D3) — the ACTOR is not the SuperAdmin.

export const roleLabels: Record<RoleType, string> = {
  [RoleType.Regular]: 'Пользователь',
  [RoleType.TourManager]: 'Тур-менеджер',
  [RoleType.Admin]: 'Администратор',
}

/** Short description of what each tier can do — shown under the table, not per row. */
export const roleHints: Record<RoleType, string> = {
  [RoleType.Regular]: 'клиент сайта, без доступа к панели',
  [RoleType.TourManager]: 'создаёт и редактирует туры, архивирует; без удаления и настроек',
  [RoleType.Admin]: 'полный доступ, включая справочники, настройки и роли',
}

/**
 * Translate a `RoleType` tier into the `UserRole` row id that `ChangeRole` expects.
 *
 * Derived from the loaded list first — any account already on that tier proves the mapping — and
 * only falls back to the numeric identity that the seed migration happens to produce (rows 1/2/3
 * with matching `Type`) when no such account exists yet. Doing it this way means a re-seeded or
 * manually edited `UserRole` table cannot silently assign the wrong role.
 */
export function roleIdFor(role: RoleType, users: UserInfoModel[]): number {
  return users.find((user) => user.role === role)?.roleId ?? role
}

const ROLE_ORDER: RoleType[] = [RoleType.Regular, RoleType.TourManager, RoleType.Admin]

/**
 * Options for one row's `RoleSelect` (D3, 2026-08-09).
 *
 * «Администратор» is offered ONLY to the SuperAdmin — an ordinary admin cannot promote anyone, and
 * showing an option the backend answers 403 to would be a lie.
 *
 * The CURRENT value is always included even when `allowAdminOption` is false. That is not a
 * courtesy, it is a correctness requirement: `Select` renders the placeholder («Выберите…») when
 * `value` matches no option, so dropping the Admin option from an Admin row would replace the
 * account's actual role with "nothing selected". The row stays readable — «Администратор», disabled,
 * with `ADMIN_ROLE_IMMUTABLE_HINT` underneath.
 */
export function buildRoleOptions(currentValue: RoleType, allowAdminOption: boolean): SelectOption[] {
  return ROLE_ORDER.filter(
    (role) => role !== RoleType.Admin || allowAdminOption || currentValue === RoleType.Admin,
  ).map((role) => ({ value: String(role), label: roleLabels[role] }))
}

export function usersErrorMessage(err: unknown, action: string): string {
  if (err instanceof ApiError) {
    const code = errorCodeOf(err.body)
    if (code === ADMIN_ROLE_IMMUTABLE) {
      return 'Роль администратора можно снять только напрямую в базе данных.'
    }
    if (code === CANNOT_DELETE_SELF) {
      return 'Нельзя удалить свою же учётную запись.'
    }
    if (code === ADMIN_ACCOUNT_IMMUTABLE) {
      return 'Аккаунт администратора можно удалить только напрямую в базе данных.'
    }
    if (code === SUPER_ADMIN_REQUIRED) {
      return 'Действия с ролью администратора доступны только главному администратору.'
    }
    if (code === ACCOUNT_DELETED) {
      return 'Этот пользователь уже удалён — обновите страницу.'
    }
    if (err.status === 403) {
      return `Не удалось ${action}: недостаточно прав.`
    }
    return `Не удалось ${action}: сервер вернул ошибку (${err.status}).`
  }
  return `Не удалось ${action}: проверьте соединение и попробуйте ещё раз.`
}

/** Explanatory text under a disabled `RoleSelect` (F5). As of D3 this is shown only when the actor
 * is NOT the SuperAdmin — for the SuperAdmin the control is live, so the hint would be wrong. */
export const ADMIN_ROLE_IMMUTABLE_HINT =
  'Снять роль администратора может только главный администратор'

/** Confirm dialog for promoting somebody to Admin (D5). Promotion had no confirmation at all
 * before — it was a plain select — which is too quiet for the one change that hands over full
 * control of the panel. */
export const promoteCopy = {
  title: (userLabel: string) => `Назначить «${userLabel}» администратором?`,
  body:
    'Администратор получает полный доступ к панели: справочники, настройки, удаление туров и ' +
    'управление ролями других пользователей. Снять эту роль сможет только главный администратор.',
  confirm: 'Назначить',
  pending: 'Назначаем…',
} as const

/** Copy for the user-detail screen (F4/F14) — kept next to the rest of this feature's Russian
 * copy, same convention as `roleLabels`/`roleHints` above. */
export const userDetailCopy = {
  helpTitle: 'Карточка пользователя',
  helpBody:
    '«В сети» — приблизительный статус: считается по времени последнего авторизованного запроса ' +
    'этого пользователя, обновляется не чаще раза в 5 минут, без отдельного опроса сервера. IP и ' +
    'страна показываются только здесь, не в общем списке пользователей. Удаление — мягкое: аккаунт ' +
    'скрывается из панели и перестаёт работать, но его данные не стираются физически; после удаления ' +
    'тот же email/логин можно зарегистрировать заново.',
  deleteTitle: (userLabel: string) => `Удалить пользователя «${userLabel}»?`,
  deleteBody:
    'Аккаунт будет деактивирован и скрыт из списка пользователей. Восстановить его из панели ' +
    'администратора нельзя.',
  /** Harsher variant for deleting ANOTHER ADMIN's account (D3) — only the SuperAdmin ever sees the
   * button enabled in that case, and the consequences are wider than for a regular account. */
  deleteAdminBody:
    'Это учётная запись АДМИНИСТРАТОРА. Вместе с доступом к панели она потеряет и права на ' +
    'справочники, настройки и управление ролями. Аккаунт будет деактивирован и скрыт из списка; ' +
    'восстановить его из панели нельзя.',
  deleteSelfHint: 'Свою же учётную запись удалить нельзя',
  deleteAdminHint: 'Удалить аккаунт администратора может только главный администратор',
  resetTitle: (userLabel: string) => `Сбросить пароль «${userLabel}»?`,
  resetBody: 'Пользователь будет обязан задать новый пароль при следующем входе.',
} as const

function errorCodeOf(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const record = body as Record<string, unknown>
  const raw = record.errorCode ?? record.ErrorCode
  return typeof raw === 'number' ? raw : undefined
}
