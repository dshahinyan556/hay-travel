/**
 * Admin Reference Catalog API — one function per backend endpoint, all routed through
 * `authFetch`. Backend route bases: `api/Place`, `api/ExpenseTemplate`, `api/TourNoteTemplate`,
 * `api/Region`, `api/VehicleClass`.
 *
 * Each catalog is its OWN permission key (`catalog.places`, `catalog.expense-templates`,
 * `catalog.note-templates`, `catalog.regions`, `catalog.tags`, `catalog.vehicle-classes`) — six
 * independent keys behind one `/admin/catalog` route, by decision 7 of the roles checklist.
 * `GetAll` needs that key's `View`, every write its `Create`/`Update`/`Delete`.
 *
 * Note the reach of the View flags: the TOUR FORM loads all five to fill its pickers, so a role
 * that may create tours but cannot read the catalogs gets a 403 on the form itself. The role editor
 * warns about that combination instead of the form degrading silently.
 *
 * Regions have no write endpoints on the backend (they are fixed, seeded reference data —
 * `docs/backend-stage3-sync.md` §3.2), so only `getRegions` exists here.
 *
 * `Create`/`Update` both return the freshly re-read `*InfoModel` — the caller replaces that one
 * row in its list rather than refetching everything.
 */

import { authFetch } from '@/shared/auth'
import type {
  ExpenseTemplateCreateModel,
  ExpenseTemplateInfoModel,
  PlaceCreateModel,
  PlaceInfoModel,
  RegionInfoModel,
  TagCreateModel,
  TagInfoModel,
  TourNoteTemplateCreateModel,
  TourNoteTemplateInfoModel,
  VehicleClassCreateModel,
  VehicleClassInfoModel,
} from '@/shared/types/attours'

/* -------------------------------------------------------------------------- */
/*  Places                                                                     */
/* -------------------------------------------------------------------------- */

export function getPlaces(): Promise<PlaceInfoModel[]> {
  return authFetch<PlaceInfoModel[]>('api/Place/GetAll')
}

export function createPlace(model: PlaceCreateModel): Promise<PlaceInfoModel> {
  return authFetch<PlaceInfoModel>('api/Place/Create', {
    method: 'POST',
    body: JSON.stringify(model),
  })
}

export function updatePlace(model: PlaceInfoModel): Promise<PlaceInfoModel> {
  return authFetch<PlaceInfoModel>('api/Place/Update', {
    method: 'PUT',
    body: JSON.stringify(model),
  })
}

/** Rejects with `ApiError` carrying `errorCode: CatalogEntryInUse` (2010) when the place is
 * still referenced by a route point. */
export function deletePlace(id: number): Promise<void> {
  return authFetch<void>(`api/Place/Delete?id=${id}`, { method: 'DELETE' })
}

/* -------------------------------------------------------------------------- */
/*  Expense templates                                                          */
/* -------------------------------------------------------------------------- */

export function getExpenseTemplates(): Promise<ExpenseTemplateInfoModel[]> {
  return authFetch<ExpenseTemplateInfoModel[]>('api/ExpenseTemplate/GetAll')
}

export function createExpenseTemplate(
  model: ExpenseTemplateCreateModel,
): Promise<ExpenseTemplateInfoModel> {
  return authFetch<ExpenseTemplateInfoModel>('api/ExpenseTemplate/Create', {
    method: 'POST',
    body: JSON.stringify(model),
  })
}

export function updateExpenseTemplate(
  model: ExpenseTemplateInfoModel,
): Promise<ExpenseTemplateInfoModel> {
  return authFetch<ExpenseTemplateInfoModel>('api/ExpenseTemplate/Update', {
    method: 'PUT',
    body: JSON.stringify(model),
  })
}

/** Rejects with `ApiError` carrying `errorCode: CatalogEntryInUse` (2010) when still referenced
 * by an additional expense. */
export function deleteExpenseTemplate(id: number): Promise<void> {
  return authFetch<void>(`api/ExpenseTemplate/Delete?id=${id}`, { method: 'DELETE' })
}

/* -------------------------------------------------------------------------- */
/*  Tour note templates                                                        */
/* -------------------------------------------------------------------------- */

export function getTourNoteTemplates(): Promise<TourNoteTemplateInfoModel[]> {
  return authFetch<TourNoteTemplateInfoModel[]>('api/TourNoteTemplate/GetAll')
}

export function createTourNoteTemplate(
  model: TourNoteTemplateCreateModel,
): Promise<TourNoteTemplateInfoModel> {
  return authFetch<TourNoteTemplateInfoModel>('api/TourNoteTemplate/Create', {
    method: 'POST',
    body: JSON.stringify(model),
  })
}

export function updateTourNoteTemplate(
  model: TourNoteTemplateInfoModel,
): Promise<TourNoteTemplateInfoModel> {
  return authFetch<TourNoteTemplateInfoModel>('api/TourNoteTemplate/Update', {
    method: 'PUT',
    body: JSON.stringify(model),
  })
}

/** Rejects with `ApiError` carrying `errorCode: CatalogEntryInUse` (2010) when still referenced
 * by a tour note. */
export function deleteTourNoteTemplate(id: number): Promise<void> {
  return authFetch<void>(`api/TourNoteTemplate/Delete?id=${id}`, { method: 'DELETE' })
}

/* -------------------------------------------------------------------------- */
/*  Tags                                                                       */
/* -------------------------------------------------------------------------- */

export function getTags(): Promise<TagInfoModel[]> {
  return authFetch<TagInfoModel[]>('api/Tag/GetAll')
}

export function createTag(model: TagCreateModel): Promise<TagInfoModel> {
  return authFetch<TagInfoModel>('api/Tag/Create', {
    method: 'POST',
    body: JSON.stringify(model),
  })
}

export function updateTag(model: TagInfoModel): Promise<TagInfoModel> {
  return authFetch<TagInfoModel>('api/Tag/Update', {
    method: 'PUT',
    body: JSON.stringify(model),
  })
}

/** Rejects with `ApiError` carrying `errorCode: CatalogEntryInUse` (2010) when still assigned to
 * a tour. */
export function deleteTag(id: number): Promise<void> {
  return authFetch<void>(`api/Tag/Delete?id=${id}`, { method: 'DELETE' })
}

/* -------------------------------------------------------------------------- */
/*  Regions                                                                    */
/* -------------------------------------------------------------------------- */

/** Both languages, `tourCount` included — the admin list, not the public single-locale one. */
export function getRegions(): Promise<RegionInfoModel[]> {
  return authFetch<RegionInfoModel[]>('api/Region/GetAll')
}

/** Name/slug/order stay fixed (seeded reference data) — this only edits the teaser (`blurb`)
 * shown on the public map/region panel. Void response: caller revalidates the region list. */
export function updateRegionBlurb(id: number, blurbRu: string, blurbEn: string): Promise<void> {
  return authFetch<void>('api/Region/UpdateBlurb', {
    method: 'PUT',
    body: JSON.stringify({ id, blurbRu, blurbEn }),
  })
}

/* -------------------------------------------------------------------------- */
/*  Vehicle classes (batch 2026-08-29, decision 0.7) — pricing tiers for      */
/*  predefined transfers. `catalog.vehicle-classes` permission key.           */
/* -------------------------------------------------------------------------- */

export function getVehicleClasses(): Promise<VehicleClassInfoModel[]> {
  return authFetch<VehicleClassInfoModel[]>('api/VehicleClass/GetAll')
}

export function createVehicleClass(model: VehicleClassCreateModel): Promise<VehicleClassInfoModel> {
  return authFetch<VehicleClassInfoModel>('api/VehicleClass/Create', {
    method: 'POST',
    body: JSON.stringify(model),
  })
}

export function updateVehicleClass(model: VehicleClassInfoModel): Promise<VehicleClassInfoModel> {
  return authFetch<VehicleClassInfoModel>('api/VehicleClass/Update', {
    method: 'PUT',
    body: JSON.stringify(model),
  })
}

/** Rejects with `ApiError` carrying `errorCode: CatalogEntryInUse` (2010) when still referenced
 * by a transfer's pricing table or by an order line. */
export function deleteVehicleClass(id: number): Promise<void> {
  return authFetch<void>(`api/VehicleClass/Delete?id=${id}`, { method: 'DELETE' })
}
