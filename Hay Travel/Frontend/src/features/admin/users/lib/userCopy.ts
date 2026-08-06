/**
 * Russian copy and error mapping for the Пользователи screen. The admin panel is Russian-only by
 * design (`Hay Travel/CLAUDE.md`), so this mirrors `catalog/lib/catalogErrors.ts` rather than
 * going through the public site's dictionary.
 */

import { ApiError } from '@/shared/lib/http'
import { RoleType, type UserInfoModel } from '@/shared/auth'

/** `GlobalErrorCode` values this screen's mutations can report — the admin panel keeps its own
 * local copy of the numeric codes it cares about rather than a shared dictionary (mirrors
 * `catalogErrors.ts`/`ProductsPage.tsx`'s own `errorCodeOf`, the established pattern here; the
 * i18n `AuthErrorCode` in `shared/auth` is for the public site's login/register forms only). */
const ADMIN_ROLE_IMMUTABLE = 2214 // ChangeRole (B6) — target's current role is Admin.
const CANNOT_DELETE_SELF = 2212 // Delete (B4).
const ACCOUNT_DELETED = 2213 // Delete (B4) — target was already soft-deleted (stale page).
const ADMIN_ACCOUNT_IMMUTABLE = 2215 // Delete — target's role is Admin (mirrors ADMIN_ROLE_IMMUTABLE).

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

/** Explanatory text under a disabled `RoleSelect` (F5) — same reasoning `isSelf` already gets,
 * extended to any row whose CURRENT role is Admin (B6's unconditional backend guard). */
export const ADMIN_ROLE_IMMUTABLE_HINT = 'Роль администратора можно снять только напрямую в базе'

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
  deleteSelfHint: 'Свою же учётную запись удалить нельзя',
  deleteAdminHint: 'Аккаунт администратора можно удалить только напрямую в базе',
  resetTitle: (userLabel: string) => `Сбросить пароль «${userLabel}»?`,
  resetBody: 'Пользователь будет обязан задать новый пароль при следующем входе.',
} as const

function errorCodeOf(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const record = body as Record<string, unknown>
  const raw = record.errorCode ?? record.ErrorCode
  return typeof raw === 'number' ? raw : undefined
}
