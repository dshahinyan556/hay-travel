/**
 * Public surface of the booking domain layer (ADR 022 / spec 008 §3).
 *
 * Three of these modules used to be feature-local to `features/tours` (`lib/bookingWindow.ts`,
 * `lib/tourDiscount.ts`, `hooks/useTierPrice.ts`). The cart made that untenable: `features/cart`
 * needs the exact same booking window, the exact same "discount resolved against the PICKED trip
 * date" rule and the exact same group tier — and features may never import from one another.
 *
 * Transport stays where it was: `shared/api/booking.ts` is the HTTP layer and is deliberately NOT
 * folded in here — moving it would touch unrelated call sites for the sake of name symmetry.
 */

export { BOOKING_WINDOW_MONTHS, getBookingWindow } from './bookingWindow'
export type { BookingWindow } from './bookingWindow'

export { discountedPriceOn, isDiscountActiveOn } from './tourDiscount'

export { PREPAYMENT_SHARE, useTierPrice } from './useTierPrice'
export type { TierPriceView } from './useTierPrice'

export { MAX_GUESTS, MIN_GUESTS, clampGuests } from './guests'
