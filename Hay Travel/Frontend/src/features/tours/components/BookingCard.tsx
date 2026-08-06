import { useId, useMemo, useState } from 'react'
import type { Tour } from '@/shared/types/tour'
import { addMonths, formatISODate, stripTime } from '@/shared/lib/date'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { DatePicker } from '@/shared/ui'
import { CheckIcon, GuideIcon } from '@/shared/ui/icons'
import { useTierPrice } from '../hooks/useTierPrice'

/**
 * Booking box — UI only, wired for a backend that doesn't exist yet.
 *
 * There is no booking endpoint (see `docs/client-site.md`), so submitting shows a local
 * confirmation instead of posting. The shape is deliberately the one the real flow will need —
 * date, guest count, computed total — so hooking it up later is a matter of replacing the submit
 * handler, not rebuilding the form.
 *
 * ── Group pricing (2026-08) ───────────────────────────────────────────────────────────────────
 * 1–4 guests pay the base price, 5–6 pay a surcharge, and from 7 there is no displayed price at
 * all: the block becomes an invitation to request a quote. All three tiers come from
 * `useTierPrice`, which composes the single copy of the rule in `shared/currency/pricing.ts`.
 *
 * The 5–6 surcharge gets NO badge, no "+20%", no strikethrough: the requirement is a price, not a
 * disclosed markup, and surfacing the multiplier invites "why am I being charged more" on a page
 * with no place to answer it.
 */

const MIN_GUESTS = 1
const MAX_GUESTS = 16

/**
 * David's rule: the bookable window is today .. today + 3 calendar months, same day-of-month
 * (clamped by `addMonths` when the target month is shorter). Purely a frontend limit — no backend
 * availability entity exists.
 */
const BOOKING_WINDOW_MONTHS = 3

export function BookingCard({
  tour,
  largeGroupInvitation,
}: {
  tour: Tour
  /** Resolved by the loader (site setting, with a dictionary fallback) — this component does not
   * fetch or translate it, so it stays presentational w.r.t. site settings. */
  largeGroupInvitation: string
}) {
  const dateFieldId = useId()
  const dateLabelId = useId()
  const dateErrorId = `${dateFieldId}-error`
  const { t } = useLocale()

  const [guests, setGuests] = useState(2)
  const [date, setDate] = useState('')
  // The date field used to be an `<input type="date" required>`, where the browser blocked submit
  // on its own. `DatePicker`'s trigger is a `<button>`, which no form validation applies to, so
  // that guard now lives here — otherwise an empty date would silently "book".
  const [dateMissing, setDateMissing] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const price = useTierPrice(tour.priceFrom, guests)

  // `[]`: `new Date()` is a fresh object every render, so without the memo `DatePicker`'s own
  // `maxDate` memo would re-run on every keystroke elsewhere in this form. A tab does not usefully
  // cross midnight mid-session — the same snapshot assumption `DatePicker`'s `today` already makes.
  // No `min` is passed: `disablePast` already covers the lower bound and defaults to `true`.
  const maxDate = useMemo(
    () => formatISODate(addMonths(stripTime(new Date()), BOOKING_WINDOW_MONTHS)),
    [],
  )

  if (submitted) {
    return (
      <div className="rounded-2xl bg-panel p-6 text-center ring-1 ring-gold-line">
        <span className="inline-flex text-gold-ink">
          <CheckIcon size={28} />
        </span>
        <p className="mt-3 font-display text-xl text-ink">{t('booking.submittedTitle')}</p>
        <p className="mt-2 text-sm text-ink-muted">{t('booking.submittedBody')}</p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="mt-4 text-sm text-gold-ink transition-colors hover:text-accent-strong"
        >
          {t('booking.editSubmission')}
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (date === '') {
          setDateMissing(true)
          return
        }
        setSubmitted(true)
      }}
      className="rounded-2xl bg-panel p-5 ring-1 ring-edge"
    >
      {/* `aria-live`: crossing 6→7 with the counter swaps a price for a sentence — that has to be
          announced, not silently substituted. */}
      <div aria-live="polite" className="flex items-end justify-between gap-3 border-b border-edge pb-4">
        {price.hidden ? (
          // Body copy, not the price treatment: it is a sentence, not a number. The "цена от"
          // caption is dropped here — there is no price for it to label.
          <p className="text-sm leading-relaxed text-ink-dim">{largeGroupInvitation}</p>
        ) : (
          <div>
            <p className="text-[10px] tracking-wide text-ink-muted">{t('booking.priceFrom')}</p>
            <p className="font-display text-3xl text-gold-ink">{price.perPerson}</p>
            <p className="mt-0.5 text-xs text-ink-muted">{t('booking.perPerson')}</p>
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
          }}
          max={maxDate}
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
          <span className="min-w-8 text-center font-display text-xl text-ink">{guests}</span>
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

      {/* Removed entirely at 7+, not blanked and not shown as "—": there is no total, and an empty
          definition list is noise for a screen reader. */}
      {!price.hidden && (
        <dl className="mt-4 space-y-1.5 border-t border-edge pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-muted">{t('booking.total')}</dt>
            <dd className="text-ink">{price.total}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">{t('booking.prepayment')}</dt>
            <dd className="text-gold-ink">{price.prepayment}</dd>
          </div>
        </dl>
      )}

      {/* Kept and ENABLED at 7+, only the copy changes: disabling it would delete the only path to
          the action the invitation text just asked for. The underlying flow is already "a request
          with no payment", so 7+ is the same action with honest wording. */}
      <button
        type="submit"
        className="mt-5 w-full rounded-full bg-gold-fill px-5 py-3 text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none"
      >
        {price.hidden ? t('booking.submitLargeGroup') : t('booking.submit')}
      </button>
      <p className="mt-2.5 text-center text-xs text-ink-muted">
        {price.hidden ? t('booking.submitHintLargeGroup') : t('booking.submitHint')}
      </p>
    </form>
  )
}
