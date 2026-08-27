/**
 * Reading the checkout's failure answers (spec 008 §7.4).
 *
 * `POST api/Order/Create` is ATOMIC (ADR 025): a rejection means NOTHING was created, so every
 * function here describes a cart that is still exactly as the visitor left it. There is no
 * "partially created" body to parse, and adding one later would be a contract change, not a new
 * branch.
 *
 * Two shapes of failure, deliberately kept apart:
 *  - PER-LINE (`errorCode` 2031 + a `lines` array) — each entry blames one submitted line and is
 *    rendered inline on that cart row;
 *  - FLAT (2028 / 2032 / 401 / network / anything unrecognised) — nothing can be blamed on one
 *    row, so it becomes one message under the submit button.
 *
 * `errorCodeOf` moved here verbatim from `BookingCard`, which no longer talks to the network at
 * all.
 */

import { SessionExpiredError } from '@/shared/auth'
import { ApiError } from '@/shared/lib/http'
import type { TranslationKey } from '@/shared/i18n/translate'
import type { OrderLineErrorItem } from '@/shared/types/booking'

export type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string

/* Per-line `GlobalErrorCode` values (spec 001 §7 / spec 013). Local numeric constants — the same
   convention `users/lib/userCopy.ts` follows. 2015 became genuinely reachable with the cart: a
   position can sit in localStorage from before the bounds changed. */
const TOUR_NOT_FOUND = 2004
const TOUR_DATE_UNAVAILABLE = 2014
const INVALID_GUEST_COUNT = 2015
const ORDER_DATE_IN_PAST = 2016

/** Top-level codes of a whole-request rejection. */
export const ORDER_MUST_HAVE_AT_LEAST_ONE_LINE = 2028
export const ORDER_HAS_INVALID_LINES = 2031
export const ORDER_TOO_MANY_LINES = 2032

export type CheckoutLineFailureReason =
  | 'tourNotFound' // 2004
  | 'dateUnavailable' // 2014
  | 'guestCount' // 2015
  | 'datePast' // 2016
  | 'unknown' // код есть, но нам неизвестен

/** `errorCode` as the backend spells it (`ErrorModelExceptionHandler` uses camelCase, some older
 * handlers PascalCase) — same reader as `userCopy.ts`. */
export function errorCodeOf(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const record = body as Record<string, unknown>
  const raw = record.errorCode ?? record.ErrorCode
  return typeof raw === 'number' ? raw : undefined
}

function lineErrorItemOf(row: unknown): OrderLineErrorItem | null {
  if (typeof row !== 'object' || row === null) return null
  const record = row as Record<string, unknown>
  const index = record.index ?? record.Index
  const tourId = record.tourId ?? record.TourId
  const tourDate = record.tourDate ?? record.TourDate
  const errorCode = record.errorCode ?? record.ErrorCode
  if (typeof index !== 'number' || typeof tourId !== 'number') return null
  if (typeof tourDate !== 'string' || typeof errorCode !== 'number') return null
  // `DateOnly` serialises as `YYYY-MM-DD`, but a handler that ever sends a full timestamp would
  // otherwise silently stop matching cart ids — cut it to the day rather than fail the match.
  return { index, tourId, tourDate: tourDate.slice(0, 10), errorCode }
}

/** Пер-строчные ошибки из тела 400. Пустой массив — тело не в формате `OrderLinesErrorModel`. */
export function orderLineErrorsOf(body: unknown): readonly OrderLineErrorItem[] {
  if (typeof body !== 'object' || body === null) return []
  const record = body as Record<string, unknown>
  const raw = record.lines ?? record.Lines
  if (!Array.isArray(raw)) return []
  return raw.flatMap((row) => {
    const item = lineErrorItemOf(row)
    return item ? [item] : []
  })
}

export function lineFailureReason(errorCode: number): CheckoutLineFailureReason {
  switch (errorCode) {
    case TOUR_NOT_FOUND:
      return 'tourNotFound'
    case TOUR_DATE_UNAVAILABLE:
      return 'dateUnavailable'
    case INVALID_GUEST_COUNT:
      return 'guestCount'
    case ORDER_DATE_IN_PAST:
      return 'datePast'
    default:
      return 'unknown'
  }
}

/** Existing copy only — a rejected line says the same thing it said when the booking form was the
 * one receiving these codes. */
export function lineFailureMessage(reason: CheckoutLineFailureReason, t: Translate): string {
  switch (reason) {
    case 'tourNotFound':
      return t('cart.line.unavailable')
    case 'dateUnavailable':
      return t('booking.dateUnavailable')
    case 'guestCount':
      return t('cart.line.guestCountInvalid')
    case 'datePast':
      return t('booking.datePast')
    default:
      return t('booking.submitFailed')
  }
}

/** Копия для `formError`: сессия, сеть, 2028/2032, всё нераспознанное. */
export function checkoutFormMessage(err: unknown, t: Translate): string {
  if (err instanceof SessionExpiredError) return t('booking.sessionExpired')
  if (err instanceof ApiError) {
    // A bodyless 401 that `authFetch` could not renew arrives here rather than as
    // `SessionExpiredError` only when the retry itself failed differently — treat it the same.
    if (err.status === 401) return t('booking.sessionExpired')
    const code = errorCodeOf(err.body)
    // Unreachable while the client cap holds — handled as a client/server drift, not as
    // "this cannot happen".
    if (code === ORDER_TOO_MANY_LINES) return t('cart.error.tooManyLines')
  }
  return t('booking.submitFailed')
}

/** `true` when the visitor's session, not their cart, is the problem — the page shows the sign-in
 * block instead of blaming a row. */
export function isSessionFailure(err: unknown): boolean {
  if (err instanceof SessionExpiredError) return true
  return err instanceof ApiError && err.status === 401
}
