import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router'
import type { TourDetail } from '@/shared/types/tour'
import { addCartItem } from '@/shared/cart'
import { discountedPriceOn, getBookingWindow, MAX_GUESTS, MIN_GUESTS, useTierPrice } from '@/shared/booking'
import { parseISODate } from '@/shared/lib/date'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { DatePicker, GuestStepper, type DatePickerDiscountRange } from '@/shared/ui'
import { CheckIcon, GuideIcon } from '@/shared/ui/icons'

/**
 * Booking box — picks a trip date and a guest count and puts THAT choice into the cart
 * (`shared/cart`, ADR 022). It no longer creates an order.
 *
 * ── What changed with the cart (2026-08-22) ───────────────────────────────────────────────────
 * This card used to call `POST api/Order/Create` itself and switch to a confirmation screen. All
 * of that moved to `/cart`, which sends the WHOLE cart as one atomic multi-line order (ADR 025).
 * As a result this component now makes NO network request at all and knows nothing about
 * authentication: the entire backend contact of the public site converges on one call, on one
 * page. Signing in is asked for there, at the moment of sending.
 *
 * There is deliberately NO redirect to `/cart` after adding. Auto-navigating would turn the cart
 * back into the one-step booking it replaces and make accumulating several trips awkward — so the
 * confirmation is inline, over the button, and the form stays mounted with the picked date and
 * guest count intact. The visitor can immediately pick another date of the same tour and add a
 * second position.
 *
 * ── Group pricing (2026-08) ───────────────────────────────────────────────────────────────────
 * 1–4 guests pay the base price, 5–6 pay a surcharge, and from 7 there is no displayed price at
 * all: the block becomes an invitation to request a quote. All three tiers come from
 * `useTierPrice`, which composes the single copy of the rule in `shared/currency/pricing.ts`.
 *
 * ── Discount by trip date (2026-08-18) ────────────────────────────────────────────────────────
 * A tour's discount applies to a RANGE of trip dates. The calendar marks those days with a red
 * "-N%" ribbon before anything is picked, and the total below follows the picked date rather than
 * "today" — see `shared/booking/tourDiscount.ts` for why the card resolves that itself.
 *
 * The 5–6 surcharge gets NO badge, no "+20%", no strikethrough: the requirement is a price, not a
 * disclosed markup, and surfacing the multiplier invites "why am I being charged more" on a page
 * with no place to answer it. The 7+ branch adds the SAME cart position; only the copy changes.
 */

/** Restores a selection the visitor made before being sent to `/auth` (§4.3 p.1). Read straight
 * from `location.search` rather than `useSearchParams`: the restore is one-shot, subscribing to
 * URL changes would only re-run it. Kept after the cart landed — the cart itself no longer needs
 * it (it survives a login on its own), but `?date=&guests=` is still a working deep link into a
 * tour with a pre-filled form, and deleting working code has no upside. */
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

  // Named `bookingWindow`, not `window`: this component reads the global `location`, and shadowing
  // `window` inside it is the kind of trap that only shows up at runtime.
  // `[]`: `new Date()` is a fresh object every render, so without the memo `DatePicker`'s own
  // `maxDate` memo would re-run on every keystroke elsewhere in this form. A tab does not usefully
  // cross midnight mid-session — the same snapshot assumption `DatePicker`'s `today` already makes.
  const bookingWindow = useMemo(() => getBookingWindow(), [])

  // Stable reference required by `DatePicker.disabledDates` — it feeds that component's
  // `isDisabledDate` memo. There is no `serverClosed` counterpart any more: only `/cart` talks to
  // the server, so only `/cart` can learn that a day was rejected.
  const disabledDates = useMemo(() => new Set(closedDates), [closedDates])

  const [guests, setGuests] = useState(initialGuestsFromQuery)
  const [date, setDate] = useState(() =>
    // Lazy initialiser, not an effect: restoring after render would flash an empty form first.
    initialDateFromQuery(disabledDates, bookingWindow.fromISO, bookingWindow.toISO),
  )
  // The date field used to be an `<input type="date" required>`, where the browser blocked submit
  // on its own. `DatePicker`'s trigger is a `<button>`, which no form validation applies to, so
  // that guard now lives here — otherwise an empty date would silently reach the cart.
  const [dateMissing, setDateMissing] = useState(false)
  const [added, setAdded] = useState<'added' | 'updated' | null>(null)
  const [cartFull, setCartFull] = useState(false)

  /* The "-N%" ribbon in the calendar (2026-08-18). Straight from the tour's raw campaign range,
     which is why it can advertise a campaign that has not started yet — `discountedPrice` alone
     could not. Days closed for booking never get it (see `DatePicker.discountRange`). */
  const discountRange: DatePickerDiscountRange | null =
    tour.discountWindow === null
      ? null
      : {
          start: tour.discountWindow.startDate,
          end: tour.discountWindow.endDate,
          percent: tour.discountWindow.percent,
        }

  /* Before a date is picked there is nothing to resolve against, so the card keeps showing the
     server's "today" figure — the same number the catalog card and the page header show. Once a
     date exists, the discount follows THAT date, exactly like the order the backend will create
     (see `shared/booking/tourDiscount.ts`). */
  const discountedForDate =
    date === '' ? tour.discountedPrice : discountedPriceOn(tour.priceFrom, tour.discountWindow, date)

  const price = useTierPrice(tour.priceFrom, guests, discountedForDate)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (date === '') {
      setDateMissing(true)
      return
    }

    setCartFull(false)
    const result = addCartItem({
      tourId: Number(tour.id),
      tourDate: date,
      guestCount: guests,
      snapshot: {
        title: tour.title,
        coverImage: tour.coverImage,
        kind: tour.kind,
        durationDays: tour.durationDays,
        durationNights: tour.durationNights,
      },
    })

    if (result === 'full') {
      // The button stays enabled: removing a position elsewhere makes the same press work.
      setCartFull(true)
      return
    }
    setAdded(result)
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
            {price.originalTotal !== null ? (
              <p className="text-xs text-ink-muted line-through">{price.originalTotal}</p>
            ) : (
              <p className="text-[10px] tracking-wide text-ink-muted">{t('booking.total')}</p>
            )}
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
            // A new date is a different cart position, so the confirmation for the previous one
            // must not stay on screen claiming this one was added.
            setAdded(null)
            setCartFull(false)
          }}
          max={bookingWindow.toISO}
          disabledDates={disabledDates}
          discountRange={discountRange}
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
        <div className="mt-1.5">
          <GuestStepper
            value={guests}
            onChange={setGuests}
            labelFewer={t('booking.guestsFewer')}
            labelMore={t('booking.guestsMore')}
          />
        </div>
      </div>

      {added === null ? (
        <>
          {/* Kept and ENABLED at 7+, and the label no longer changes with the tier either: the
              action is now "put this in the cart", which is the same action regardless of group
              size. */}
          <button
            type="submit"
            className="btn-sheen mt-5 w-full rounded-full bg-gold-fill px-5 py-3 text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none"
          >
            {t('cart.addToCart')}
          </button>

          {/* Stays directly under the button so the default state of the card is unchanged. */}
          <p className="mt-2.5 text-center text-xs text-ink-muted">
            {price.hidden ? t('booking.submitHintLargeGroup') : t('booking.submitHint')}
          </p>

          {cartFull && (
            <p role="alert" className="mt-2.5 text-sm break-words text-danger">
              {t('cart.error.full')}
            </p>
          )}
        </>
      ) : (
        /* Takes the place of the button rather than appearing under it, so the card does not grow
           downward under the cursor at the moment of the click. */
        <div role="status" className="mt-5 rounded-xl bg-panel-raised p-3.5 ring-1 ring-gold-line">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <span className="shrink-0 text-gold-ink">
              <CheckIcon size={17} />
            </span>
            {added === 'updated' ? t('cart.added.titleUpdated') : t('cart.added.title')}
          </p>
          <Link
            to="/cart"
            className="mt-3 flex min-h-11 w-full items-center justify-center rounded-full bg-gold-fill px-5 py-2.5 text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel-raised focus-visible:outline-none"
          >
            {t('cart.added.goToCart')}
          </Link>
          {/* Returns the form so a second date of the SAME tour can be added right away — that is
              the whole point of not auto-navigating. */}
          <button
            type="button"
            onClick={() => setAdded(null)}
            className="mt-1 min-h-11 w-full text-[13.5px] font-medium text-gold-ink transition-colors hover:text-accent-strong focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
          >
            {t('cart.added.continue')}
          </button>
        </div>
      )}
    </form>
  )
}
