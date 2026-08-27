/**
 * Discount as it applies to a CHOSEN TRIP DATE, for the booking form.
 *
 * Everywhere else on the public site a discount is the server's single resolved number
 * (`Tour.discountedPrice` — "is it on today"), and nothing is recomputed client-side. The booking
 * card is the one place where that answer is not enough: the visitor picks a date, and the price
 * the backend will actually snapshot is resolved against THAT date, not against today
 * (`OrderCreationService` → `ResolveActiveDiscountPercent(tour, tourDate)`).
 *
 * So the card would otherwise show one figure and charge another in two real cases:
 *   - a campaign that is live today, with a trip date past its end → card shows the discount, the
 *     order is created at full price;
 *   - a campaign that starts next month → the calendar shows the "-N%" ribbon on those days, but
 *     the total under it would stay at full price.
 *
 * The backend stays the source of truth for the money that is charged; this only keeps what is
 * DISPLAYED in step with the date the visitor just picked. It therefore mirrors
 * `TourDiscountExtensions` exactly — inclusive `[start; end]` range, `null` start meaning "no
 * lower bound", and the same round-to-whole-dram step (`Math.round` is half-up, matching
 * `MidpointRounding.AwayFromZero` for the positive amounts this deals in).
 */

import type { TourDiscountWindow } from '@/shared/types/tour'

/** Whether `isoDate` (`YYYY-MM-DD`) falls inside the campaign. ISO strings compare correctly with
 * `<=`, so no `Date` is built. */
export function isDiscountActiveOn(window: TourDiscountWindow | null, isoDate: string): boolean {
  if (window === null || isoDate === '') return false
  return isoDate <= window.endDate && (window.startDate === null || isoDate >= window.startDate)
}

/**
 * Price after the tour's discount for a trip on `isoDate`, or `null` when the campaign does not
 * cover that date — the same "null means no discount" contract `Tour.discountedPrice` uses, so the
 * result drops straight into `useTierPrice`.
 */
export function discountedPriceOn(
  basePriceAmd: number,
  window: TourDiscountWindow | null,
  isoDate: string,
): number | null {
  if (window === null || !isDiscountActiveOn(window, isoDate)) return null
  return Math.round(basePriceAmd * (1 - window.percent / 100))
}
