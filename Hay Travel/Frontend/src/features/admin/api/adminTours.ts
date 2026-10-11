/**
 * Admin Tour API — one function per backend endpoint, all routed through `authFetch`.
 *
 * Backend route base is `api/Tour`. Covers the full lifecycle: create, read, update,
 * publish-toggle and delete.
 *
 * Permissions (enforced server-side, mirrored by `shared/auth/permissions`): everything here is the
 * `products` screen key. Reads need `products.View`; `InitTour`/`CreateTour` need `products.Create`;
 * `UpdateTour`, `SetActive`, `SetArchived`, `SetFeatured` and `ReorderFeatured` all need
 * `products.Update` (the three toggles moved under Update — §0.3 of the backend architecture — they
 * are edits to a tour, not a category of their own); `DeleteTour` needs `products.Delete`.
 */

import { authFetch } from '@/shared/auth'
import { ApiError } from '@/shared/lib/http'
import type { TourType } from '@/features/admin/lib/enums'
import type { TourCreateModel, TourCreatedModel, TourInfoModel } from '@/shared/types/attours'

/** How many tours may be featured at once — mirrors `TourFeaturedService.MaxFeaturedTours`
 * (backend). The server is the authority: this number only feeds copy («N из 9») and never gates
 * a request on its own. NB: the server counts ARCHIVED featured tours too (archiving does not
 * clear `IsFeatured`). */
export const MAX_FEATURED_TOURS = 9

/** `GlobalErrorCode.TooManyFeaturedTours` — what `SetFeatured` answers once the cap is reached. */
const TOO_MANY_FEATURED_CODE = 2011

/** True when `err` is the backend's "already 9 featured" rejection of `setTourFeatured`. Shared by
 * the products list and the product card, which both turn it into their own sentence. */
export function isTooManyFeaturedError(err: unknown): boolean {
  if (!(err instanceof ApiError) || typeof err.body !== 'object' || err.body === null) return false
  const record = err.body as Record<string, unknown>
  return (record.errorCode ?? record.ErrorCode) === TOO_MANY_FEATURED_CODE
}

/** GET the empty create skeleton for a given tour type. */
export function initTour(type: TourType): Promise<TourCreateModel> {
  return authFetch<TourCreateModel>(`api/Tour/InitTour?type=${type}`)
}

/** POST a new tour/excursion. Returns the id of the created tour. */
export function createTour(model: TourCreateModel): Promise<TourCreatedModel> {
  return authFetch<TourCreatedModel>('api/Tour/CreateTour', {
    method: 'POST',
    body: JSON.stringify(model),
  })
}

/** GET every non-archived tour for the admin list. */
export function getAllTours(): Promise<TourInfoModel[]> {
  return authFetch<TourInfoModel[]>('api/Tour/GetAll')
}

/** GET every archived (soft-deleted) tour. */
export function getArchivedTours(): Promise<TourInfoModel[]> {
  return authFetch<TourInfoModel[]>('api/Tour/GetArchived')
}

/** GET the full edit model for one tour (all languages). */
export function initUpdate(id: number): Promise<TourInfoModel> {
  return authFetch<TourInfoModel>(`api/Tour/InitUpdate?id=${id}`)
}

/** PUT the full desired state of an existing tour; the server diffs it against the stored
 * graph. Returns the reconciled tour. `model.id` identifies which tour to update. */
export function updateTour(model: TourInfoModel): Promise<TourInfoModel> {
  return authFetch<TourInfoModel>('api/Tour/UpdateTour', {
    method: 'PUT',
    body: JSON.stringify(model),
  })
}

/** PATCH the published flag of a tour (publish / unpublish). */
export function setTourActive(id: number, isActive: boolean): Promise<void> {
  return authFetch<void>('api/Tour/SetActive', {
    method: 'PATCH',
    body: JSON.stringify({ id, isActive }),
  })
}

/** PATCH the archived flag of a tour (archive / restore). Soft-delete — reversible. */
export function setTourArchived(id: number, isArchived: boolean): Promise<void> {
  return authFetch<void>('api/Tour/SetArchived', {
    method: 'PATCH',
    body: JSON.stringify({ id, isArchived }),
  })
}

/** PATCH the featured flag of a tour (show / hide in the public "избранное" section). Rejects
 * with `ApiError` carrying `errorCode: TooManyFeaturedTours` (2011) when 9 are already featured —
 * see `isTooManyFeaturedError`. Not part of `UpdateTour` (the server ignores `isFeatured` there),
 * so the product card calls this after a successful save when the checkbox changed. */
export function setTourFeatured(id: number, isFeatured: boolean): Promise<void> {
  return authFetch<void>('api/Tour/SetFeatured', {
    method: 'PATCH',
    body: JSON.stringify({ id, isFeatured }),
  })
}

/** PATCH the display order of the currently featured tours. `orderedIds` must contain exactly
 * the ids that are currently featured, in the desired order — anything else 400s. */
export function reorderFeaturedTours(orderedIds: number[]): Promise<void> {
  return authFetch<void>('api/Tour/ReorderFeatured', {
    method: 'PATCH',
    body: JSON.stringify({ orderedIds }),
  })
}

/** DELETE a tour and its whole graph (days, translations, images, …) via server cascade.
 * Irreversible — used to permanently remove a tour from the archive. */
export function deleteTour(id: number): Promise<void> {
  return authFetch<void>(`api/Tour/DeleteTour?id=${id}`, { method: 'DELETE' })
}
