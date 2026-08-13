/**
 * The bookable date window, as a value instead of a constant buried in `BookingCard`.
 *
 * It moved out of the card because two call sites need the same bounds now: `tourDetailLoader`
 * asks the server which days inside the window are closed, and the card feeds the upper bound to
 * `DatePicker` as `max`.
 */

import { addMonths, formatISODate, stripTime } from '@/shared/lib/date'

/**
 * David's rule: bookable from today through "today + 3 calendar months", same day-of-month
 * (clamped by `addMonths` when the target month is shorter).
 *
 * Purely a FRONTEND limit — the backend does not enforce it (spec 001 §8); it only rejects dates
 * in the past and days closed by a rule. So this window narrows what we offer, it never widens
 * what is actually accepted.
 */
export const BOOKING_WINDOW_MONTHS = 3

export interface BookingWindow {
  /** `YYYY-MM-DD`, inclusive. */
  fromISO: string
  /** `YYYY-MM-DD`, inclusive. */
  toISO: string
}

/**
 * Snapshot of the window "as of now".
 *
 * Call it once per screen load (in the loader) and memoize it in the component — the same
 * "a tab does not usefully live across midnight" assumption `DatePicker`'s own `today` already
 * makes.
 */
export function getBookingWindow(now: Date = new Date()): BookingWindow {
  const from = stripTime(now)
  return {
    fromISO: formatISODate(from),
    toISO: formatISODate(addMonths(from, BOOKING_WINDOW_MONTHS)),
  }
}
