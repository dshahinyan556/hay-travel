/**
 * Public-site tour model.
 *
 * Lives in `shared/types` because several features need it (home, catalog, the region map
 * panel) and features must not import from one another — only through `shared`.
 *
 * This is the PUBLIC shape, deliberately separate from the admin/backend wire model in
 * `shared/types/attours.ts`. The site currently runs on mocks (`shared/api/tours.ts`); when
 * the real API lands, only that module changes — this type is the contract components rely on.
 */

import type { RegionSlug } from '@/shared/data/armeniaRegions'

/**
 * Product kind. Mirrors the domain rule enforced by the admin panel and backend:
 * an excursion is exactly 1 day (no overnight stay), a tour is 2+ days (at least 1 night).
 * See `docs/product-model.md`.
 */
export type TourKind = 'tour' | 'excursion'

/** Trust/USP signals rendered on the card itself — there is no separate "why choose us" block. */
export type TourBadgeType = 'popular' | 'discount' | 'lastSeats' | 'guide'

export interface TourBadge {
  type: TourBadgeType
  label: string
}

export interface ItineraryDay {
  day: number
  title: string
  description: string
  /** Stops visited on this day, in order. */
  routePoints: string[]
}

export interface Tour {
  id: string
  /** URL-friendly identifier, used in the `/tours/:slug` route. */
  slug: string
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
  currency: 'USD' | 'AMD'
  coverImage: string
  gallery: readonly string[]
  shortDescription: string
  /** Rating out of 5, and how many reviews it came from. */
  rating: number
  reviewCount: number
  badges: readonly TourBadge[]
  itinerary: readonly ItineraryDay[]
  included: readonly string[]
  excluded: readonly string[]
}
