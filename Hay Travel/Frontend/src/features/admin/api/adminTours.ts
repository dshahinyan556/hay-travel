/**
 * Admin Tour API — one function per backend endpoint, all routed through `apiFetch`.
 *
 * Backend route base is `api/Tour`. Covers the full lifecycle: create, read, update,
 * publish-toggle and delete.
 */

import { apiFetch } from '@/shared/lib/http'
import type { TourType } from '@/features/admin/lib/enums'
import type { TourCreateModel, TourCreatedModel, TourInfoModel } from '@/shared/types/attours'

/** GET the empty create skeleton for a given tour type. */
export function initTour(type: TourType): Promise<TourCreateModel> {
  return apiFetch<TourCreateModel>(`api/Tour/InitTour?type=${type}`)
}

/** POST a new tour/excursion. Returns the id of the created tour. */
export function createTour(model: TourCreateModel): Promise<TourCreatedModel> {
  return apiFetch<TourCreatedModel>('api/Tour/CreateTour', {
    method: 'POST',
    body: JSON.stringify(model),
  })
}

/** GET every non-archived tour for the admin list. */
export function getAllTours(): Promise<TourInfoModel[]> {
  return apiFetch<TourInfoModel[]>('api/Tour/GetAll')
}

/** GET every archived (soft-deleted) tour. */
export function getArchivedTours(): Promise<TourInfoModel[]> {
  return apiFetch<TourInfoModel[]>('api/Tour/GetArchived')
}

/** GET the full edit model for one tour (all languages). */
export function initUpdate(id: number): Promise<TourInfoModel> {
  return apiFetch<TourInfoModel>(`api/Tour/InitUpdate?id=${id}`)
}

/** PUT the full desired state of an existing tour; the server diffs it against the stored
 * graph. Returns the reconciled tour. `model.id` identifies which tour to update. */
export function updateTour(model: TourInfoModel): Promise<TourInfoModel> {
  return apiFetch<TourInfoModel>('api/Tour/UpdateTour', {
    method: 'PUT',
    body: JSON.stringify(model),
  })
}

/** PATCH the published flag of a tour (publish / unpublish). */
export function setTourActive(id: number, isActive: boolean): Promise<void> {
  return apiFetch<void>('api/Tour/SetActive', {
    method: 'PATCH',
    body: JSON.stringify({ id, isActive }),
  })
}

/** PATCH the archived flag of a tour (archive / restore). Soft-delete — reversible. */
export function setTourArchived(id: number, isArchived: boolean): Promise<void> {
  return apiFetch<void>('api/Tour/SetArchived', {
    method: 'PATCH',
    body: JSON.stringify({ id, isArchived }),
  })
}

/** DELETE a tour and its whole graph (days, translations, images, …) via server cascade.
 * Irreversible — used to permanently remove a tour from the archive. */
export function deleteTour(id: number): Promise<void> {
  return apiFetch<void>(`api/Tour/DeleteTour?id=${id}`, { method: 'DELETE' })
}
