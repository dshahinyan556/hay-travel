/** Turns a thrown catalog-API error into a Russian message. Shared by all three CRUD tabs
 * (Places / Expense templates / Note templates) — same error codes, same wording. */

import { ApiError } from '@/shared/lib/http'

/** `GlobalErrorCode.CatalogEntryInUse` — delete blocked, a tour still references this entry. */
const CATALOG_ENTRY_IN_USE = 2010
/** `GlobalErrorCode.InvalidEntityRelation` — e.g. a duplicate `Place.Slug`. */
const INVALID_ENTITY_RELATION = 2001

/** Pull the backend error code out of an error body (`{ message, errorCode }`). */
function errorCodeOf(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const record = body as Record<string, unknown>
  const raw = record.errorCode ?? record.ErrorCode
  return typeof raw === 'number' ? raw : undefined
}

export function catalogErrorMessage(err: unknown, action: string): string {
  if (err instanceof ApiError) {
    const code = errorCodeOf(err.body)
    if (code === CATALOG_ENTRY_IN_USE) {
      return 'Эта запись используется в турах — сначала уберите её оттуда, затем удалите.'
    }
    if (code === INVALID_ENTITY_RELATION) {
      return `Не удалось ${action}: проверьте введённые данные (например, уникальность значения).`
    }
    return `Не удалось ${action}: сервер вернул ошибку (${err.status}).`
  }
  return `Не удалось ${action}: проверьте соединение и попробуйте ещё раз.`
}
