/**
 * Public-site tour model.
 *
 * Lives in `shared/types` because several features need it (home, catalog, the region map
 * panel) and features must not import from one another — only through `shared`.
 *
 * This is the PUBLIC shape, deliberately separate from the admin/backend wire model in
 * `shared/types/attours.ts` — `shared/api/tours.ts` is the one module that maps between them.
 *
 * Two shapes, not one, because the backend itself serves two different projections (stage 5):
 * `GetToursClient` returns a lightweight card (no itinerary/gallery/notes), `GetTourInfo` returns
 * the full graph. `TourDetail` extends `Tour` rather than duplicating its fields, so every place
 * that only needs the card shape (grids, the region panel, the "related" strip) accepts either.
 */

import type { RegionSlug } from '@/shared/data/armeniaRegions'

/**
 * Product kind. Mirrors the domain rule enforced by the admin panel and backend:
 * an excursion is exactly 1 day (no overnight stay), a tour is 2+ days (at least 1 night).
 * See `docs/product-model.md`.
 */
export type TourKind = 'tour' | 'excursion'

export interface ItineraryDay {
  day: number
  title: string
  description: string
  /** Stops visited on this day, in order. */
  routePoints: string[]
}

/** One line item under "Дополнительные расходы" — a cost not folded into `priceFrom`. */
export interface TourExpense {
  label: string
  amount: number | null
}

export interface Tour {
  id: string
  title: string
  kind: TourKind
  /**
   * Regions this product covers. Many-to-many: a multi-day tour crosses several regions,
   * which is what lets the map show a tour under every region it passes through.
   */
  regionSlugs: readonly RegionSlug[]
  durationDays: number
  /** 0 for an excursion by definition. */
  durationNights: number
  priceFrom: number
  coverImage: string
  shortDescription: string
}

export interface TourDetail extends Tour {
  /** Показывать ли блок предоплаты в BookingCard (B12, 2026-08-13). Сумма предоплаты
   * по-прежнему единая для всех туров (`useTierPrice`) — это только видимость блока. */
  requiresPrepayment: boolean
  gallery: readonly string[]
  itinerary: readonly ItineraryDay[]
  /** Organizational notes (`TourNoteType.OrganizationalDetail` on the backend) — practical
   * things worth knowing, shown under "Организационные детали". */
  organizationalDetails: readonly string[]
  /** Restriction notes (`TourNoteType.Restriction`) — shown under "Ограничения". */
  restrictions: readonly string[]
  /** What the price covers (`TourNoteType.Included`) — shown under "Включено". */
  included: readonly string[]
  /** What the price does not cover (`TourNoteType.NotIncluded`) — shown under "Не включено". */
  notIncluded: readonly string[]
  expenses: readonly TourExpense[]
}
