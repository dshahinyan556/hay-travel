/** Turns a thrown catalog-API error into a message in the current interface locale. Shared by all
 * four CRUD tabs (Places / Expense templates / Note templates / Tags) — same error codes, same
 * wording. Pure: the caller resolves `catalogCopy` (it is a component or a hook, it has the
 * locale) and passes both the copy and an already-localised `action` verb phrase in. */

import { ApiError } from '@/shared/lib/http'
import type { CatalogCopy } from './catalogCopy'

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

/**
 * @param inUseMessage Override for the `CatalogEntryInUse` wording — the shared `errors.inUse`
 * says "used in tours", which fits Places/Expenses/Notes/Tags but not Vehicle classes (used by
 * transfers/orders, not by tours directly). Defaults to the shared message.
 */
export function catalogErrorMessage(
  copy: CatalogCopy,
  err: unknown,
  action: string,
  inUseMessage: string = copy.common.errors.inUse,
): string {
  const errors = copy.common.errors
  if (err instanceof ApiError) {
    const code = errorCodeOf(err.body)
    if (code === CATALOG_ENTRY_IN_USE) return inUseMessage
    if (code === INVALID_ENTITY_RELATION) return errors.invalidData(action)
    return errors.server(action, err.status)
  }
  return errors.network(action)
}
