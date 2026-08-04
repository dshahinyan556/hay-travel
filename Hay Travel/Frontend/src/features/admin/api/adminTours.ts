/**
 * Admin Tour API — one function per backend endpoint, all routed through `authFetch`.
 *
 * Backend route base is `api/Tour`. Covers the full lifecycle: create, read, update,
 * publish-toggle and delete.
 *
 * Roles (enforced server-side, mirrored by `shared/auth/permissions`): TourManager+Admin may
 * read/create/update/publish/archive; `DeleteTour`, `SetFeatured` and `ReorderFeatured` are
 * Admin-only and answer 403 for a TourManager, which is why the UI hides those controls.
 */

import { authFetch } from '@/shared/auth'
import type { TourType } from '@/features/admin/lib/enums'
import type { TourCreateModel, TourCreatedModel, TourInfoModel } from '@/shared/types/attours'

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
 * with `ApiError` carrying `errorCode: TooManyFeaturedTours` (2011) when 6 are already featured. */
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
