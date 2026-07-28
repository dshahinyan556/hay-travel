/**
 * Wire types for the admin Tour API — a 1:1 mirror of the backend contract.
 *
 * These are intentionally "dumb" DTOs: enums are plain numbers (the backend serialises
 * enums as their integer value), translations are flat lists keyed by `type`+`languageCode`,
 * and there is no client-side ergonomics here. Turning these into a form-friendly shape is
 * the job of `features/admin/lib/tourMapper.ts` — the single place that knows the mapping.
 *
 * Two parallel families:
 *  - `*CreateModel` — id-less payloads sent to the server on create.
 *  - `*InfoModel`   — read models returned by the server, each element carrying its `id`.
 */

/* -------------------------------------------------------------------------- */
/*  Create models (id-less, outbound)                                          */
/* -------------------------------------------------------------------------- */

export interface TranslatableCreateModel {
  /** Field discriminator; meaning depends on the owning entity (see enums in features/admin). */
  type: number
  languageCode: number
  value: string | null
}

export interface GalleryImageCreateModel {
  url: string
  sortOrder: number
}

export interface RoutePointCreateModel {
  sortOrder: number
  /** Route points have a single textual field, so `translations[].type` is always 0. */
  translations: TranslatableCreateModel[]
}

export interface AdditionalExpenseCreateModel {
  amount: number | null
  translations: TranslatableCreateModel[]
}

export interface TourDayCreateModel {
  price: number
  translations: TranslatableCreateModel[]
  galleryImages: GalleryImageCreateModel[]
  routePoints: RoutePointCreateModel[]
}

/** Ordered, multi-value bilingual field on the tour. `translations[].type` is always 0
 * (single text field). Both organizational details and restrictions share this shape. */
export interface OrganizationalDetailCreateModel {
  sortOrder: number
  translations: TranslatableCreateModel[]
}

export interface RestrictionCreateModel {
  sortOrder: number
  translations: TranslatableCreateModel[]
}

export interface TourCreateModel {
  type: number
  mainImageUrl: string | null
  isActive: boolean
  tourDays: TourDayCreateModel[]
  translations: TranslatableCreateModel[]
  additionalExpenses: AdditionalExpenseCreateModel[]
  organizationalDetails: OrganizationalDetailCreateModel[]
  restrictions: RestrictionCreateModel[]
}

/** Response of `CreateTour` — the id of the freshly created tour. */
export interface TourCreatedModel {
  id: number
}

/* -------------------------------------------------------------------------- */
/*  Info models (with id, inbound)                                             */
/* -------------------------------------------------------------------------- */

export interface TranslatableInfoModel {
  id: number
  type: number
  languageCode: number
  value: string | null
}

export interface GalleryImageInfoModel {
  id: number
  url: string
  sortOrder: number
}

export interface RoutePointInfoModel {
  id: number
  sortOrder: number
  translations: TranslatableInfoModel[]
}

export interface AdditionalExpenseInfoModel {
  id: number
  amount: number | null
  translations: TranslatableInfoModel[]
}

export interface TourDayInfoModel {
  id: number
  price: number
  translations: TranslatableInfoModel[]
  galleryImages: GalleryImageInfoModel[]
  routePoints: RoutePointInfoModel[]
}

export interface OrganizationalDetailInfoModel {
  id: number
  sortOrder: number
  translations: TranslatableInfoModel[]
}

export interface RestrictionInfoModel {
  id: number
  sortOrder: number
  translations: TranslatableInfoModel[]
}

export interface TourInfoModel {
  id: number
  type: number
  /** Published flag. Backend ignores this field on `UpdateTour` (managed via `SetActive`),
   * but returns it on reads and echoes it back on update responses. */
  isActive: boolean
  /** Soft-delete flag. Archived tours are hidden from the main list (`GetAll`) and returned by
   * `GetArchived`. Managed via `SetArchived`; ignored by `UpdateTour`, like `isActive`. */
  isArchived: boolean
  /** Sum of every day's price, computed on the server. Read-only; omitted from update payloads. */
  totalPrice?: number | null
  mainImageUrl: string | null
  tourDays: TourDayInfoModel[]
  translations: TranslatableInfoModel[]
  additionalExpenses: AdditionalExpenseInfoModel[]
  organizationalDetails: OrganizationalDetailInfoModel[]
  restrictions: RestrictionInfoModel[]
}
