/**
 * Russian copy and error mapping for the Пользователи screen. The admin panel is Russian-only by
 * design (`Hay Travel/CLAUDE.md`), so this mirrors `catalog/lib/catalogErrors.ts` rather than
 * going through the public site's dictionary.
 */

import { ApiError } from '@/shared/lib/http'
import { RoleType, type UserInfoModel } from '@/shared/auth'

/** `GlobalErrorCode.InvalidEntityRelation` — both role guards report this one code. */
const INVALID_ENTITY_RELATION = 2001

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
    if (code === INVALID_ENTITY_RELATION) {
      return 'Нельзя снять роль администратора: это последний администратор в системе.'
    }
    if (err.status === 403) {
      return `Не удалось ${action}: недостаточно прав.`
    }
    return `Не удалось ${action}: сервер вернул ошибку (${err.status}).`
  }
  return `Не удалось ${action}: проверьте соединение и попробуйте ещё раз.`
}

function errorCodeOf(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const record = body as Record<string, unknown>
  const raw = record.errorCode ?? record.ErrorCode
  return typeof raw === 'number' ? raw : undefined
}
