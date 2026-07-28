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

/** A single translatable field held as its two language values. */
export interface Localized {
  ru: string
  en: string
}

/** One gallery image of a day. `sortOrder` on the wire is derived from array index. */
export interface GalleryItemFormState {
  /** Client-only stable id for React keys and array operations. */
  key: string
  /** Present only when editing an existing record (from InitUpdate). */
  serverId?: number
  url: string
}

/** An ordered, bilingual list item. Shared shape for the three "repeater of a single
 * bilingual text" fields: a day's route points, and the tour's organizational details and
 * restrictions. Order is derived from array index (mapped to the backend `sortOrder`). */
export interface LocalizedListItem {
  key: string
  serverId?: number
  text: Localized
}

/** One route point of a day. A day can have many, ordered by array index. */
export type RoutePointFormState = LocalizedListItem

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
}

/** The whole create/edit form. */
export interface TourFormState {
  type: TourType
  mainImageUrl: string
  isActive: boolean
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
  days: TourDayFormState[]
  additionalExpenses: ExpenseFormState[]
}
