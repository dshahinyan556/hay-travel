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

/** A merch tag on the card ("Хит сезона", …), admin-managed (`features/admin/catalog/tags`) —
 * purely decorative, discount is NOT a tag (see `Tour.discountedPrice`). `label` is the
 * admin-typed name, verbatim. `color` is one of the site's 5 palette tokens (`shared/ui/
 * ProductTag`'s `TagColor` numbering), never a free hex. */
export interface TourTag {
  id: number
  color: number
  label: string
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
  /** Server-resolved price after an active tour discount — `null` when there is none or it has
   * expired (`Tour.DiscountPercent`/`DiscountValidUntil` on the backend). `priceFrom` stays the
   * "old" price for a strikethrough; this is the bold new one. Nothing here is computed
   * client-side on purpose — the backend already checked the expiry date. */
  discountedPrice: number | null
  /** ISO `YYYY-MM-DD` — начало акции (2026-08-18). Скидка активна в диапазоне
   * [`discountStartDate`; `discountValidUntil`] включительно; `null` = нижней границы нет
   * (старые записи). Only meaningful alongside a non-null `discountedPrice`. */
  discountStartDate: string | null
  /** ISO `YYYY-MM-DD` — only meaningful alongside a non-null `discountedPrice`. */
  discountValidUntil: string | null
  coverImage: string
  shortDescription: string
  /** Up to 3. Empty when the product has none. */
  tags: readonly TourTag[]
}

/**
 * The RAW discount window of a tour, exactly as the admin configured it — percent plus an
 * inclusive `[startDate; endDate]` range of trip dates it applies to.
 *
 * Deliberately different from the `Tour.discount*` fields: on the card projection those are the
 * server's answer for TODAY (all of them null as soon as the campaign has not started or has
 * ended), which is all a catalog card needs. The booking calendar needs the window itself,
 * because it has to mark FUTURE days the visitor has not picked yet.
 *
 * Only on `TourDetail` — `GetTourInfo` is the projection that returns the range unfiltered.
 */
export interface TourDiscountWindow {
  /** Percent off, as entered by the admin (e.g. `15` → "-15%"). Always > 0. */
  percent: number
  /** ISO `YYYY-MM-DD`, inclusive. `null` for rows created before the field existed — it means
   * "no lower bound" (the discount has been running since forever), NOT "no discount". */
  startDate: string | null
  /** ISO `YYYY-MM-DD`, inclusive. */
  endDate: string
}

export interface TourDetail extends Tour {
  /** `null` when the tour has no discount configured at all. Note that a non-null window can
   * still be entirely in the past or entirely in the future — it is a range, not a live flag;
   * `discountedPrice` remains the "is it on right now" answer. */
  discountWindow: TourDiscountWindow | null
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
