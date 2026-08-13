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

/** Ordered, multi-value bilingual field on the tour. `translations[].type` always 0 (single
 * text field). The kind of note (organizational detail vs. restriction) is set by `type`;
 * `sortOrder` is an index WITHIN that kind, so a tour has two independent 0..n-1 ranges. */
export interface TourNoteCreateModel {
  type: number
  sortOrder: number
  translations: TranslatableCreateModel[]
}

export interface TourCreateModel {
  type: number
  mainImageUrl: string | null
  isActive: boolean
  requiresPrepayment: boolean
  tourDays: TourDayCreateModel[]
  translations: TranslatableCreateModel[]
  additionalExpenses: AdditionalExpenseCreateModel[]
  notes: TourNoteCreateModel[]
  regions: TourRegionCreateModel[]
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

export interface TourNoteInfoModel {
  id: number
  type: number
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
  /** Shows the tour in the public home page's "featured" section (at most 6 at once). Managed
   * via `SetFeatured`; ignored by `UpdateTour`, like `isActive`/`isArchived`. */
  isFeatured: boolean
  /** Position within the featured set (0-based). Only meaningful while `isFeatured`. Managed via
   * `ReorderFeatured`; ignored by `UpdateTour`. */
  featuredSortOrder: number
  /** Показывать ли блок предоплаты на публичной странице тура (B12, 2026-08-13). В отличие
   * от isFeatured/isActive — редактируется прямо через `UpdateTour`, отдельного toggle-
   * эндпоинта нет. */
  requiresPrepayment: boolean
  /** Sum of every day's price, computed on the server. Read-only; omitted from update payloads. */
  totalPrice?: number | null
  mainImageUrl: string | null
  tourDays: TourDayInfoModel[]
  translations: TranslatableInfoModel[]
  additionalExpenses: AdditionalExpenseInfoModel[]
  notes: TourNoteInfoModel[]
  /** `UpdateTour` contract: omitting this field (`undefined`) leaves the tour's regions
   * untouched; `[]` clears them all. The admin form always sends the real list now (4.4), so a
   * save always reflects exactly what's checked — never omits the field. */
  regions?: TourRegionInfoModel[]
}

/** Public catalog card (`GET api/Tour/GetToursClient`) — a lightweight projection of
 * `TourInfoModel`: no day graph, no route points/expenses/notes, translations already resolved
 * to the one requested `languageCode` (see `TourOverrideProjection.ProjectCards`). There is no
 * `slug` (the entity has none) and no rating/badges/review-count (not in the backend's domain
 * model at all) — the public site does not invent them. */
export interface TourCardModel {
  id: number
  type: number
  totalPrice: number | null
  mainImageUrl: string | null
  durationDays: number
  translations: TranslatableInfoModel[]
  regions: TourRegionInfoModel[]
}

/* -------------------------------------------------------------------------- */
/*  Site settings                                                              */
/* -------------------------------------------------------------------------- */

/**
 * One row of `GET api/SiteSettings/GetAll` — a catalog entry merged with whatever the DB
 * holds for it. The catalog lives in backend code (ADR 002), so this endpoint always returns
 * the full key set: a key that was never saved comes back with `id: 0` and the catalog
 * default. The admin screen therefore has no key list of its own.
 *
 * Metadata (`group`, `valueType`, `isTranslatable`, `isPublic`, `sortOrder`) is not stored in
 * the DB — it is stamped onto the response from the catalog and is read-only for the client.
 */
/** Одна опция Select-настройки. `label` — подпись для админки, не публикуется на сайте. */
export interface SiteSettingOptionModel {
  value: string
  label: string
}

export interface SiteSettingInfoModel {
  /** 0 = the key is known to the catalog but has never been saved to the DB. */
  id: number
  key: string
  /** `SiteSettingGroup` (see `features/admin/lib/enums.ts`). */
  group: number
  /** `SettingValueType` — a rendering hint only; every value is stored as a string. */
  valueType: number
  isTranslatable: boolean
  isPublic: boolean
  sortOrder: number
  /**
   * Опции для `valueType === Select`, из каталога бэкенда; в БД не хранятся.
   * Необязательное поле: бэкенд, ещё не выкативший Spec 002, его просто не пришлёт — фронт
   * не должен от этого падать.
   */
  options?: SiteSettingOptionModel[]
  value: string | null
  /** Present only for translatable keys. `type` is meaningless here (server sends 0). */
  translations: TranslatableInfoModel[]
}

/**
 * One command of `PUT api/SiteSettings/Update`. Identity is `key`, NOT an id — the endpoint
 * upserts, so a key with no DB row yet is created. The payload may be partial: only the keys
 * present in it are touched.
 *
 * Careful: the server reconciles translations **by `languageCode`** and deletes any stored
 * language missing from the payload. A translatable key must therefore always carry BOTH
 * rows (RU + EN). See `features/admin/settings/lib/settingsMapper.ts`.
 */
export interface SiteSettingUpdateModel {
  key: string
  value: string | null
  translations: TranslatableCreateModel[]
}

/* -------------------------------------------------------------------------- */
/*  Reference catalogs (4.2)                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A route-point catalog entry. `regionSlug` is denormalized by the server so the admin list
 * doesn't need a second request to show a human-readable region. `translations[].type` is
 * always 0 (the entry has one text field: its name).
 */
/** One photo of a route-point catalog entry (B10, 2026-08-06). `Place.imageUrl` remains a
 * separate cover/legacy field alongside this list — it is not replaced by it. */
export interface PlaceImageInfoModel {
  id: number
  url: string
  sortOrder: number
}

export interface PlaceImageCreateModel {
  url: string
  sortOrder: number
}

export interface PlaceInfoModel {
  id: number
  slug: string
  regionId: number
  regionSlug: string
  latitude: number | null
  longitude: number | null
  imageUrl: string
  sortOrder: number
  translations: TranslatableInfoModel[]
  images: PlaceImageInfoModel[]
}

export interface PlaceCreateModel {
  slug: string
  regionId: number
  latitude: number | null
  longitude: number | null
  imageUrl: string
  sortOrder: number
  translations: TranslatableCreateModel[]
  images: PlaceImageCreateModel[]
}

/** An additional-expense catalog entry. Just a name + sort order. */
export interface ExpenseTemplateInfoModel {
  id: number
  sortOrder: number
  translations: TranslatableInfoModel[]
}

export interface ExpenseTemplateCreateModel {
  sortOrder: number
  translations: TranslatableCreateModel[]
}

/** A tour-note catalog entry (organizational detail or restriction template — see
 * `TourNoteType`). Same shape as `TourNoteInfoModel`/`TourNoteCreateModel` on the tour itself. */
export interface TourNoteTemplateInfoModel {
  id: number
  /** `TourNoteType` (see `features/admin/lib/enums.ts`). */
  type: number
  sortOrder: number
  translations: TranslatableInfoModel[]
}

export interface TourNoteTemplateCreateModel {
  type: number
  sortOrder: number
  translations: TranslatableCreateModel[]
}

/**
 * One of the 11 seeded Armenian regions. Read-only on the admin side — the backend has no
 * Create/Update/Delete endpoint for regions (they are fixed reference data seeded by a
 * migration, see `docs/backend-stage3-sync.md` §3.2). `tourCount` counts published tours only
 * (`IsActive && !IsArchived`).
 */
export interface RegionInfoModel {
  id: number
  slug: string
  sortOrder: number
  tourCount: number
  translations: TranslatableInfoModel[]
}

/** A tour's link to one of its regions — flat, no nested region-with-translations: the admin
 * gets region names from `GET api/Region/GetAll` once, not repeated inside every tour. */
export interface TourRegionInfoModel {
  id: number
  regionId: number
  slug: string
  sortOrder: number
}

export interface TourRegionCreateModel {
  regionId: number
  sortOrder: number
}
