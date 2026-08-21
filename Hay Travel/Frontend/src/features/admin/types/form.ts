/**
 * Form view-model for the admin tour editor.
 *
 * This is the shape the UI binds to — deliberately different from the wire DTOs in
 * `shared/types/attours.ts`. The backend stores translatable text as a flat list of
 * `{ type, languageCode, value }` rows (two rows — RU + EN — per field); binding a form
 * directly to that is painful, so every localized field is collapsed here into a single
 * `Localized { ru, en }` pair. The flat <-> pair conversion lives in one place only:
 * `features/admin/lib/tourMapper.ts`. Components never touch the wire format.
 */

import type { TourType } from '@/features/admin/lib/enums'
import type { Localized } from '@/features/admin/types/localized'
import type { ImageListItem } from '@/features/admin/ui/ImageListEditor'

/** `Localized` now lives in `types/localized.ts` — it is shared with the settings screen
 * (ADR 004). Re-exported here so every existing `from '@/features/admin/types/form'` import
 * keeps working. */
export type { Localized }

/** One gallery image of a day. Shape now lives in `ui/ImageListEditor.tsx` (also backs the
 * Place catalog's multi-image field) — re-exported here so every existing
 * `from '@/features/admin/types/form'` import keeps working. */
export type GalleryItemFormState = ImageListItem

/** An ordered, bilingual list item. Shared shape for the three "repeater of a single
 * bilingual text" fields: a day's route points, and the tour's organizational details and
 * restrictions. Order is derived from array index (mapped to the backend `sortOrder`). */
export interface LocalizedListItem {
  key: string
  serverId?: number
  text: Localized
}

/** One route point of a day. A day can have many, ordered by array index. `placeId` is a hard
 * link to the Place catalog (F13 gap closure, 2026-08) — set when the admin picks a catalog
 * entry, `null` for a free-text point. The text stays editable after picking; the link persists
 * independently of later text edits. A route point with `placeId` set makes the backend copy
 * that Place's photos into the day's gallery automatically on save. */
export interface RoutePointFormState extends LocalizedListItem {
  placeId: number | null
}

/** One Place catalog entry offered as a hard link for a route point. */
export interface PlaceOption {
  id: number
  name: Localized
  /** Ordered image URLs offered for the gallery autofill when this Place is picked — `images`
   * if the Place has any, else a single-item fallback to its legacy `imageUrl` (mirrors the
   * backend's own fallback in `RoutePointGalleryImageCopier`). */
  images: string[]
}

/** One additional expense of the tour. */
export interface ExpenseFormState {
  key: string
  serverId?: number
  /** Kept as a string while in the input; parsed to a number on submit. */
  amount: string
  description: Localized
}

/** One day of the tour (an excursion has exactly one; a tour has 2+). */
export interface TourDayFormState {
  key: string
  serverId?: number
  /** Kept as a string while in the input; parsed to a number on submit. */
  price: string
  title: Localized
  shortDescription: Localized
  description: Localized
  duration: Localized
  routePoints: RoutePointFormState[]
  gallery: GalleryItemFormState[]
  /** Which gallery items (by `key`) were auto-added because a route point (keyed the same way)
   * is linked to a Place — session-only bookkeeping so picking a different Place for that route
   * point (or clearing the link) can swap out exactly those images without touching ones the
   * admin added by hand. Never sent to the backend. Days loaded from an existing tour start
   * empty: the backend has no record of which stored gallery image came from which Place, so a
   * route point that already had a link when the form opened is treated as "unknown origin"
   * until the admin re-picks its Place in this session. */
  autofilledImageKeys: Record<string, string[]>
}

/** Existing catalog entries offered as autocomplete while typing route points, organizational
 * details, restrictions, included/not-included items and additional expenses — loader-provided
 * reference data, not part of the form's own state (nothing here is submitted). */
export interface CatalogSuggestions {
  routePoints: Localized[]
  /** Place catalog entries a route point can be hard-linked to (F13 gap closure). */
  placeOptions: PlaceOption[]
  orgDetails: Localized[]
  restrictions: Localized[]
  included: Localized[]
  notIncluded: Localized[]
  expenses: Localized[]
}

/** One region checked on the tour (4.4). `serverId` is the join row's own id (`TourRegion.Id`,
 * distinct from `regionId`) — present when it came from `InitUpdate`, absent for a region the
 * admin just checked. Order in the array is the display/submit order; there is no reorder UI. */
export interface TourRegionFormState {
  serverId?: number
  regionId: number
}

/** One tag checked on the tour. Same `serverId`/no-reorder-UI shape as `TourRegionFormState` —
 * ordering on the card is derived from the tag's own `sortOrder`, so there is nothing to reorder
 * here. */
export interface TourTagFormState {
  serverId?: number
  tagId: number
}

/** The whole create/edit form. */
export interface TourFormState {
  type: TourType
  mainImageUrl: string
  isActive: boolean
  /** Показывать ли блок предоплаты на публичной странице тура (B12, 2026-08-13). В отличие
   * от isActive — не игнорируется UpdateTour, редактируется прямо здесь. */
  requiresPrepayment: boolean
  /** Скидка тура (Фаза 7). Строковый ввод, как `TourDayFormState.price` — пусто = без скидки.
   * Все три поля (percent + start + end) обязаны быть заданы вместе или пустыми все три
   * (validation.ts) — процент без даты окончания нарушил бы правило "скидка сама снимается
   * по дате", а без даты начала непонятно, с какого дня она действует. */
  discountPercent: string
  /** ISO `YYYY-MM-DD`, `''` = не задано. Начало акции; скидка активна в диапазоне
   * [start; end] включительно (равенство = однодневная акция). */
  discountStartDate: string
  /** ISO `YYYY-MM-DD`, `''` = не задано — тот же контракт, что у `DatePicker`. */
  discountValidUntil: string
  title: Localized
  shortDescription: Localized
  description: Localized
  duration: Localized
  /** Organizational details — an ordered list of bilingual notes (formerly the single
   * "Detail" field; now multi-value, mirroring route points). */
  organizationalDetails: LocalizedListItem[]
  /** Restrictions — an ordered list of bilingual notes (formerly the single "Restriction"
   * field; now multi-value). */
  restrictions: LocalizedListItem[]
  /** "Включено" — items the price covers. Same `TourNote` entity as the two lists above,
   * discriminated by `TourNoteType.Included` (2026-08). */
  included: LocalizedListItem[]
  /** "Не включено" — items the price does not cover (`TourNoteType.NotIncluded`, 2026-08). */
  notIncluded: LocalizedListItem[]
  days: TourDayFormState[]
  additionalExpenses: ExpenseFormState[]
  /** Regions the tour covers (4.4). Optional — a tour without a region is valid (backend D-2). */
  regions: TourRegionFormState[]
  /** Tags shown on the card (up to 3, at most 1 discount — enforced by `toggleTag` in the
   * reducer, mirrored server-side by `TourValidationService`). */
  tags: TourTagFormState[]
}
