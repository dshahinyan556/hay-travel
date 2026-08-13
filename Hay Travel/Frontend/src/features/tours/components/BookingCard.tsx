import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router'
import type { TourDetail } from '@/shared/types/tour'
import { OrderStatus, type OrderInfoModel } from '@/shared/types/booking'
import { createOrder } from '@/shared/api/booking'
import { SessionExpiredError, useAuth } from '@/shared/auth'
import { ApiError } from '@/shared/lib/http'
import { parseISODate } from '@/shared/lib/date'
import { withReturnTo } from '@/shared/lib/returnTo'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import type { TranslationKey } from '@/shared/i18n/translate'
import { DatePicker } from '@/shared/ui'
import { CheckIcon, GuideIcon } from '@/shared/ui/icons'
import { useTierPrice } from '../hooks/useTierPrice'
import { getBookingWindow } from '../lib/bookingWindow'

/**
 * Booking box — a real order form (spec 003 §4.3), backed by `POST api/Order/Create`.
 *
 * Flow: pick a date and a guest count → submit → the server creates the order and answers with it
 * → the card switches to a confirmation carrying the order number and status. Days already closed
 * for this tour arrive from the loader (`closedDates`) and are struck through in the picker; the
 * server re-checks the date anyway, and a rejection (code 2014) greys that day out too.
 *
 * Booking requires a signed-in visitor, but the card renders for everyone: an anonymous visitor
 * gets an inline "sign in to continue" block on submit, carrying their picked date and guest count
 * through `?returnTo=` so nothing is lost across the login. There is deliberately NO redirect on
 * page open — the tour page itself must stay readable anonymously.
 *
 * ── Group pricing (2026-08) ───────────────────────────────────────────────────────────────────
 * 1–4 guests pay the base price, 5–6 pay a surcharge, and from 7 there is no displayed price at
 * all: the block becomes an invitation to request a quote. All three tiers come from
 * `useTierPrice`, which composes the single copy of the rule in `shared/currency/pricing.ts`.
 *
 * The 5–6 surcharge gets NO badge, no "+20%", no strikethrough: the requirement is a price, not a
 * disclosed markup, and surfacing the multiplier invites "why am I being charged more" on a page
 * with no place to answer it. The 7+ branch submits the SAME real order — "a request without
 * payment" is the same action; only the copy changes.
 */

const MIN_GUESTS = 1
const MAX_GUESTS = 16

/* `GlobalErrorCode` values this form can actually receive (spec 001 §7). Local numeric constants,
   the same convention `users/lib/userCopy.ts` follows — the public site's `AuthErrorCode` covers
   login/register only. */
const TOUR_DATE_UNAVAILABLE = 2014
const INVALID_GUEST_COUNT = 2015 // Unreachable from this UI: the counter is clamped to 1..16.
const ORDER_DATE_IN_PAST = 2016

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string

/** `errorCode` as the backend spells it (`ErrorModelExceptionHandler` uses camelCase, some older
 * handlers PascalCase) — same reader as `userCopy.ts`. */
function errorCodeOf(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const record = body as Record<string, unknown>
  const raw = record.errorCode ?? record.ErrorCode
  return typeof raw === 'number' ? raw : undefined
}

function bookingErrorMessage(err: unknown, t: Translate): string {
  if (err instanceof SessionExpiredError) return t('booking.sessionExpired')
  if (err instanceof ApiError) {
    const code = errorCodeOf(err.body)
    if (code === TOUR_DATE_UNAVAILABLE) return t('booking.dateUnavailable')
    if (code === ORDER_DATE_IN_PAST) return t('booking.datePast')
    if (code === INVALID_GUEST_COUNT) return t('booking.submitFailed')
    // A bodyless 401 that `authFetch` could not renew arrives here rather than as
    // `SessionExpiredError` only when the retry itself failed differently — treat it the same.
    if (err.status === 401) return t('booking.sessionExpired')
  }
  return t('booking.submitFailed')
}

/** Restores a selection the visitor made before being sent to `/auth` (§4.3 p.1). Read straight
 * from `location.search` rather than `useSearchParams`: the restore is one-shot, subscribing to
 * URL changes would only re-run it. */
function initialDateFromQuery(closed: ReadonlySet<string>, fromISO: string, toISO: string): string {
  const raw = new URLSearchParams(location.search).get('date')
  if (!raw || parseISODate(raw) === null) return ''
  if (raw < fromISO || raw > toISO) return ''
  if (closed.has(raw)) return ''
  return raw
}

function initialGuestsFromQuery(): number {
  const raw = new URLSearchParams(location.search).get('guests')
  if (raw === null || !/^\d+$/.test(raw)) return 2
  const value = Number(raw)
  return value >= MIN_GUESTS && value <= MAX_GUESTS ? value : 2
}

export interface BookingCardProps {
  tour: TourDetail
  /** Resolved by the loader (site setting, with a dictionary fallback) — this component does not
   * fetch or translate it, so it stays presentational w.r.t. site settings. */
  largeGroupInvitation: string
  /**
   * Days closed for THIS tour inside the booking window (`YYYY-MM-DD`), with global rules already
   * folded in server-side (ADR 012). An empty array means "nothing closed, or the list could not
   * be loaded" — indistinguishable on purpose, because the server validates the date on create
   * either way.
   */
  closedDates: readonly string[]
}

export function BookingCard({ tour, largeGroupInvitation, closedDates }: BookingCardProps) {
  const dateFieldId = useId()
  const dateLabelId = useId()
  const dateErrorId = `${dateFieldId}-error`
  const { t } = useLocale()
  const { status } = useAuth()

  // Named `bookingWindow`, not `window`: this component reads the global `location`, and shadowing
  // `window` inside it is the kind of trap that only shows up at runtime.
  // `[]`: `new Date()` is a fresh object every render, so without the memo `DatePicker`'s own
  // `maxDate` memo would re-run on every keystroke elsewhere in this form. A tab does not usefully
  // cross midnight mid-session — the same snapshot assumption `DatePicker`'s `today` already makes.
  const bookingWindow = useMemo(() => getBookingWindow(), [])

  /** Dates the SERVER rejected as closed after the page was loaded (§4.3 p.4). */
  const [serverClosed, setServerClosed] = useState<readonly string[]>([])

  // Stable reference required by `DatePicker.disabledDates` — it feeds that component's
  // `isDisabledDate` memo.
  const disabledDates = useMemo(
    () => new Set([...closedDates, ...serverClosed]),
    [closedDates, serverClosed],
  )

  const [guests, setGuests] = useState(initialGuestsFromQuery)
  const [date, setDate] = useState(() =>
    // Lazy initialiser, not an effect: restoring after render would flash an empty form first.
    // `serverClosed` is empty on the first render, so `closedDates` is the whole exclusion set.
    initialDateFromQuery(new Set(closedDates), bookingWindow.fromISO, bookingWindow.toISO),
  )
  // The date field used to be an `<input type="date" required>`, where the browser blocked submit
  // on its own. `DatePicker`'s trigger is a `<button>`, which no form validation applies to, so
  // that guard now lives here — otherwise an empty date would silently "book".
  const [dateMissing, setDateMissing] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authNotice, setAuthNotice] = useState(false)
  const [order, setOrder] = useState<OrderInfoModel | null>(null)

  const price = useTierPrice(tour.priceFrom, guests)

  /** `'idle' | 'loading'` means the session is still being resolved — that is "unknown", not
   * "anonymous", and must not produce a "sign in" prompt. */
  const isAuthKnown = status === 'authenticated' || status === 'anonymous'

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    if (date === '') {
      // One problem at a time: an anonymous visitor with no date sees the date error first, not
      // both the date error and the sign-in block.
      setDateMissing(true)
      return
    }
    if (!isAuthKnown) return
    if (status === 'anonymous') {
      setAuthNotice(true)
      return
    }

    setPending(true)
    setError(null)
    try {
      const created = await createOrder({
        tourId: Number(tour.id),
        tourDate: date,
        guestCount: guests,
      })
      setOrder(created)
      setAuthNotice(false)
    } catch (err) {
      setError(bookingErrorMessage(err, t))
      const code = err instanceof ApiError ? errorCodeOf(err.body) : undefined
      if (code === TOUR_DATE_UNAVAILABLE || code === ORDER_DATE_IN_PAST) {
        // Grey the day out and clear the field, so pressing the button again with the same
        // rejected date is not even possible.
        setServerClosed((prev) => (prev.includes(date) ? prev : [...prev, date]))
        setDate('')
      }
      if (err instanceof SessionExpiredError || (err instanceof ApiError && err.status === 401)) {
        setAuthNotice(true)
      }
    } finally {
      setPending(false)
    }
  }

  if (order !== null) {
    const confirmed = order.status === OrderStatus.Confirmed
    return (
      <div className="rounded-2xl bg-panel p-6 text-center ring-1 ring-gold-line">
        <span className="inline-flex text-gold-ink">
          <CheckIcon size={28} />
        </span>
        <p className="mt-3 font-semibold text-xl text-ink">
          {confirmed ? t('booking.submittedTitleConfirmed') : t('booking.submittedTitle')}
        </p>
        <p className="mt-1.5 text-xs tabular-nums text-ink-muted">
          {t('booking.orderNumber', { id: order.id })}
        </p>
        <p className="mt-2 text-sm break-words text-ink-muted">
          {confirmed ? t('booking.submittedBodyConfirmed') : t('booking.submittedBody')}
        </p>
        {/* No amounts from `order.payment` anywhere on this screen. The server computes
            `TourPriceSnapshot * GuestCount` and knows nothing about the 5–6 guest tiered surcharge
            in `shared/currency/pricing.ts`, so its total can legitimately differ from the "Итого"
            shown a second ago. Money on this flow is the manager's conversation, not the card's. */}
        <button
          type="button"
          onClick={() => setOrder(null)}
          className="mt-4 min-h-11 text-sm text-gold-ink transition-colors hover:text-accent-strong"
        >
          {t('booking.editSubmission')}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl bg-panel p-5 ring-1 ring-edge">
      {/* `aria-live`: crossing 6→7 with the counter swaps a price for a sentence — that has to be
          announced, not silently substituted.

          Single price display, not two: this used to show the same total twice (a "per person"
          figure up here that was actually wrong — multiplied by guest count — plus an "Итого" row
          further down). The price is FLAT for the whole booking (up to 4 guests), so there is only
          ever one number to show; the deposit line lives right under it instead of in a separate
          block. */}
      <div aria-live="polite" className="flex items-end justify-between gap-3 border-b border-edge pb-4">
        {price.hidden ? (
          // Body copy, not the price treatment: it is a sentence, not a number.
          <p className="text-sm leading-relaxed text-ink-dim">{largeGroupInvitation}</p>
        ) : (
          <div>
            <p className="text-[10px] tracking-wide text-ink-muted">{t('booking.total')}</p>
            <p className="text-3xl font-semibold tabular-nums text-gold-ink">{price.total}</p>
            {/* Приглушённый цвет и весь текст суммы, а не только подпись (B12, 2026-08-13):
                раньше сумма предоплаты была того же золотого акцента, что и «Итого», и на
                первый взгляд читалась как второй итог. Блок опционален — per-tour флаг. */}
            {tour.requiresPrepayment && (
              <p className="mt-1 text-xs text-ink-muted">
                {t('booking.prepayment')} {price.prepayment}
              </p>
            )}
          </div>
        )}
        {!price.hidden && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-panel-raised px-2.5 py-1 text-xs text-ink-dim ring-1 ring-edge">
            <GuideIcon size={13} />
            {t('booking.smallGroup')}
          </span>
        )}
      </div>

      {/*
        A `div` with `htmlFor`, not a wrapping `label`: `DatePicker`'s trigger is a `<button>`, and
        a label wrapping a button associates nothing with it. The label also carries its own `id`,
        passed to `DatePicker` as `aria-labelledby` below — that is what names the calendar
        dialog/mobile sheet too (`DatePicker` resolves the referenced element's text itself), so
        the caption text only has to exist in one place.
      */}
      <div className="mt-4">
        <label htmlFor={dateFieldId} id={dateLabelId} className="block text-xs text-ink-muted">
          {t('booking.dateLabel')}
        </label>
        <DatePicker
          id={dateFieldId}
          value={date}
          onChange={(value) => {
            setDate(value)
            setDateMissing(false)
            setError(null)
          }}
          max={bookingWindow.toISO}
          disabledDates={disabledDates}
          required
          error={dateMissing}
          aria-labelledby={dateLabelId}
          aria-describedby={dateMissing ? dateErrorId : undefined}
          className="mt-1.5"
        />
        {dateMissing && (
          <p id={dateErrorId} role="alert" className="mt-1.5 text-xs text-danger">
            {t('booking.dateMissing')}
          </p>
        )}
      </div>

      {/* The counter stays fully active in the 7+ branch: the visitor has to be able to come back
          down to 6 and see a price again. */}
      <div className="mt-3">
        <span className="text-xs text-ink-muted">{t('booking.guests')}</span>
        <div className="mt-1.5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setGuests((g) => Math.max(MIN_GUESTS, g - 1))}
            aria-label={t('booking.guestsFewer')}
            className="h-9 w-9 rounded-full text-lg text-gold-ink ring-1 ring-edge-strong transition-colors hover:bg-accent-soft"
          >
            −
          </button>
          <span className="min-w-8 text-center font-semibold text-xl tabular-nums text-ink">{guests}</span>
          <button
            type="button"
            onClick={() => setGuests((g) => Math.min(MAX_GUESTS, g + 1))}
            aria-label={t('booking.guestsMore')}
            className="h-9 w-9 rounded-full text-lg text-gold-ink ring-1 ring-edge-strong transition-colors hover:bg-accent-soft"
          >
            +
          </button>
        </div>
      </div>

      {/* Kept and ENABLED at 7+, only the copy changes: disabling it would delete the only path to
          the action the invitation text just asked for. `!isAuthKnown` disables it only for the
          moment the session is still bootstrapping — an anonymous visitor must be able to press it
          and reach the sign-in hint. The pending label is plain text on the same line (no icon) so
          the card's height cannot change under the cursor. */}
      <button
        type="submit"
        disabled={pending || !isAuthKnown}
        className="mt-5 w-full rounded-full bg-gold-fill px-5 py-3 text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending
          ? t('booking.submitting')
          : price.hidden
            ? t('booking.submitLargeGroup')
            : t('booking.submit')}
      </button>

      {/* Stays directly under the button so the default state of the card is unchanged. */}
      <p className="mt-2.5 text-center text-xs text-ink-muted">
        {price.hidden ? t('booking.submitHintLargeGroup') : t('booking.submitHint')}
      </p>

      {error !== null && (
        <p role="alert" className="mt-2.5 text-sm break-words text-danger">
          {error}
        </p>
      )}

      {authNotice && (
        <div
          role="status"
          className="mt-3 rounded-xl bg-panel-raised p-3.5 ring-1 ring-edge-strong"
        >
          <p className="text-sm font-medium text-ink">{t('booking.authTitle')}</p>
          <p className="mt-1 text-sm break-words text-ink-muted">{t('booking.authBody')}</p>
          {/* Secondary action, not a second gold CTA — there is already one primary button above.
              The picked date and guest count ride along so the card can restore them on return. */}
          <Link
            to={withReturnTo(
              '/auth',
              `${location.pathname}?${new URLSearchParams({
                ...(date === '' ? {} : { date }),
                guests: String(guests),
              })}`,
            )}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full px-4 py-2 text-sm font-medium text-gold-ink ring-1 ring-gold-line transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none sm:w-auto"
          >
            {t('booking.authAction')}
          </Link>
        </div>
      )}
    </form>
  )
}
