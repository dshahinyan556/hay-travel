import { useId, useState } from 'react'
import type { Tour } from '@/shared/types/tour'
import { formatPrice } from '@/shared/lib/format'
import { DatePicker } from '@/shared/ui'
import { CheckIcon, GuideIcon } from '@/shared/ui/icons'

/**
 * Booking box — UI only, wired for a backend that doesn't exist yet.
 *
 * There is no user role or booking endpoint (see `docs/client-site.md`), so submitting shows a
 * local confirmation instead of posting. The shape is deliberately the one the real flow will
 * need — date, guest count, computed total — so hooking it up later is a matter of replacing
 * the submit handler, not rebuilding the form.
 *
 * The prepayment figure is shown as a share of the total rather than hardcoded, so changing
 * the policy is a one-line change.
 */
const PREPAYMENT_SHARE = 0.2

export function BookingCard({ tour }: { tour: Tour }) {
  const dateFieldId = useId()
  const dateLabelId = useId()
  const dateErrorId = `${dateFieldId}-error`

  const [guests, setGuests] = useState(2)
  const [date, setDate] = useState('')
  // The date field used to be an `<input type="date" required>`, where the browser blocked submit
  // on its own. `DatePicker`'s trigger is a `<button>`, which no form validation applies to, so
  // that guard now lives here — otherwise an empty date would silently "book".
  const [dateMissing, setDateMissing] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const total = tour.priceFrom * guests
  const prepayment = Math.round(total * PREPAYMENT_SHARE)

  if (submitted) {
    return (
      <div className="rounded-2xl bg-panel p-6 text-center ring-1 ring-gold-line">
        <span className="inline-flex text-gold-ink">
          <CheckIcon size={28} />
        </span>
        <p className="mt-3 font-display text-xl text-ink">Заявка отправлена</p>
        <p className="mt-2 text-sm text-ink-muted">
          Мы свяжемся с вами в течение дня и подтвердим даты. Предоплата — после подтверждения.
        </p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="mt-4 text-sm text-gold-ink transition-colors hover:text-accent-strong"
        >
          Изменить заявку
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
      <div className="flex items-end justify-between gap-3 border-b border-edge pb-4">
        <div>
          <p className="text-[10px] tracking-wide text-ink-muted">цена от</p>
          <p className="font-display text-3xl text-gold-ink">
            {formatPrice(tour.priceFrom, tour.currency)}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">за человека</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-panel-raised px-2.5 py-1 text-xs text-ink-dim ring-1 ring-edge">
          <GuideIcon size={13} />
          малая группа
        </span>
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
          Дата выезда
        </label>
        <DatePicker
          id={dateFieldId}
          value={date}
          onChange={(value) => {
            setDate(value)
            setDateMissing(false)
          }}
          required
          error={dateMissing}
          aria-labelledby={dateLabelId}
          aria-describedby={dateMissing ? dateErrorId : undefined}
          className="mt-1.5"
        />
        {dateMissing && (
          <p id={dateErrorId} role="alert" className="mt-1.5 text-xs text-danger">
            Выберите дату выезда
          </p>
        )}
      </div>

      <div className="mt-3">
        <span className="text-xs text-ink-muted">Гостей</span>
        <div className="mt-1.5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setGuests((g) => Math.max(1, g - 1))}
            aria-label="Меньше гостей"
            className="h-9 w-9 rounded-full text-lg text-gold-ink ring-1 ring-edge-strong transition-colors hover:bg-accent-soft"
          >
            −
          </button>
          <span className="min-w-8 text-center font-display text-xl text-ink">{guests}</span>
          <button
            type="button"
            onClick={() => setGuests((g) => Math.min(16, g + 1))}
            aria-label="Больше гостей"
            className="h-9 w-9 rounded-full text-lg text-gold-ink ring-1 ring-edge-strong transition-colors hover:bg-accent-soft"
          >
            +
          </button>
        </div>
      </div>

      <dl className="mt-4 space-y-1.5 border-t border-edge pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-muted">Итого</dt>
          <dd className="text-ink">{formatPrice(total, tour.currency)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-muted">Предоплата 20%</dt>
          <dd className="text-gold-ink">{formatPrice(prepayment, tour.currency)}</dd>
        </div>
      </dl>

      <button
        type="submit"
        className="mt-5 w-full rounded-full bg-gold-fill px-5 py-3 text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none"
      >
        Забронировать
      </button>
      <p className="mt-2.5 text-center text-xs text-ink-muted">
        Бронь без оплаты — подтвердим и пришлём детали
      </p>
    </form>
  )
}
