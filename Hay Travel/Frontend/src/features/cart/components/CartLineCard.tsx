import { useId } from 'react'
import { Link } from 'react-router'
import type { BookingWindow } from '@/shared/booking'
import { discountedPriceOn, useTierPrice } from '@/shared/booking'
import type { CartItem } from '@/shared/cart'
import type { TourDetail } from '@/shared/types/tour'
import { formatDuration } from '@/shared/lib/format'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { DatePicker, GuestStepper, KindChip, type DatePickerDiscountRange } from '@/shared/ui'
import { AlertIcon, TrashIcon } from '@/shared/ui/icons'
import { lineFailureMessage, type CheckoutLineFailureReason } from '../lib/checkoutErrors'

/**
 * One cart position (spec 008 §6).
 *
 * Fully presentational: apart from the ids it needs for `aria-*`, it holds no state. Every edit is
 * lifted to `CartPage`, which is the only component allowed to mutate the store — otherwise two
 * rows of the same tour could write conflicting snapshots.
 *
 * Unlike the booking form, a cart row can never be "date not picked": the date is part of the
 * position's identity (`${tourId}:${tourDate}`), so the only date problem that exists here is
 * "the server rejected this one".
 *
 * ── Two components, not one with an early return ──────────────────────────────────────────────
 * The "tour is gone" row renders no price, and pricing is a HOOK (`useTierPrice`). Branching
 * inside one component would make the hook list depend on whether the loader resolved that tour —
 * a real crash the first time a tour disappears while the page is open. So the branch happens at
 * the component boundary, where React allows two different hook lists.
 */
export interface CartLineCardProps {
  item: CartItem
  /** `undefined` — тур не отдался бэкендом; строка рендерится в режиме «недоступен» (§6.3). */
  tour: TourDetail | undefined
  /** Закрытые дни этого тура (из loader) + даты, отклонённые сервером в этой сессии (§7.5). */
  disabledDates: ReadonlySet<string>
  window: BookingWindow
  largeGroupInvitation: string
  /** Причина, по которой сервер отклонил именно эту позицию на последней попытке (§6.4).
   *  `null` — позиция в порядке. */
  error: CheckoutLineFailureReason | null
  /** Идёт запрос — вся строка недоступна для редактирования. */
  disabled: boolean
  onChangeDate: (itemId: string, date: string) => void
  onChangeGuests: (itemId: string, guests: number) => void
  onRemove: (itemId: string) => void
}

const THUMB_CLASS = 'h-18 w-18 shrink-0 rounded-xl object-cover lg:h-21 lg:w-28'

export function CartLineCard(props: CartLineCardProps) {
  return props.tour === undefined ? (
    <UnavailableLine item={props.item} disabled={props.disabled} onRemove={props.onRemove} />
  ) : (
    <AvailableLine {...props} tour={props.tour} />
  )
}

/* ── «Путешествие больше недоступно» (§6.3) ────────────────────────────────────────────────────
   Полей нет: редактировать нечего, а отправить эту позицию всё равно нельзя — при атомарном
   чекауте она отобьёт ВЕСЬ заказ. Кнопка удаления здесь подписана словом, а не иконкой: именно
   эта строка блокирует отправку, и посетитель обязан понять требование за секунду. */
function UnavailableLine({
  item,
  disabled,
  onRemove,
}: Pick<CartLineCardProps, 'item' | 'disabled' | 'onRemove'>) {
  const { t } = useLocale()

  return (
    <article className="rounded-2xl bg-panel p-4 opacity-60 ring-1 ring-edge lg:p-5">
      <div className="flex items-start gap-3 lg:gap-4">
        {item.snapshot.coverImage !== '' && (
          <img src={item.snapshot.coverImage} alt="" loading="lazy" className={`${THUMB_CLASS} grayscale`} />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-base text-ink-muted lg:text-lg">{item.snapshot.title}</p>
          <p role="alert" className="mt-2 max-w-[52ch] text-[13.5px] leading-snug text-ink-muted">
            {t('cart.line.unavailable')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          disabled={disabled}
          className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[13.5px] font-medium text-gold-ink ring-1 ring-gold-line transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          <TrashIcon size={15} />
          {t('cart.line.remove')}
        </button>
      </div>
    </article>
  )
}

function AvailableLine({
  item,
  tour,
  disabledDates,
  window: bookingWindow,
  largeGroupInvitation,
  error,
  disabled,
  onChangeDate,
  onChangeGuests,
  onRemove,
}: CartLineCardProps & { tour: TourDetail }) {
  const { locale, t } = useLocale()
  const dateFieldId = useId()
  const dateLabelId = useId()
  const errorId = `${dateFieldId}-error`

  const discountRange: DatePickerDiscountRange | null =
    tour.discountWindow === null
      ? null
      : {
          start: tour.discountWindow.startDate,
          end: tour.discountWindow.endDate,
          percent: tour.discountWindow.percent,
        }

  /* Same rule as the booking form: the discount follows the PICKED trip date, because that is the
     date the backend snapshots the price against (`shared/booking/tourDiscount.ts`). A cart
     position always has a date, so there is no "today" fallback branch here. */
  const discountedForDate = discountedPriceOn(tour.priceFrom, tour.discountWindow, item.tourDate)
  const price = useTierPrice(tour.priceFrom, item.guestCount, discountedForDate)

  const message = error === null ? null : lineFailureMessage(error, t)
  // Only a date-shaped rejection paints the calendar red — a guest-count problem is not the date's
  // fault, and colouring the wrong field sends the visitor to fix the wrong thing.
  const dateInvalid = error === 'dateUnavailable' || error === 'datePast'

  return (
    <article
      className={[
        'rounded-2xl bg-panel p-4 ring-1 lg:p-5',
        // Outlined, never filled: a list of four rejected rows would otherwise read as a traffic
        // light instead of a list.
        error === null ? 'ring-edge' : 'ring-danger/50',
      ].join(' ')}
    >
      <div className="flex gap-3 lg:gap-4">
        <img src={tour.coverImage || item.snapshot.coverImage} alt="" loading="lazy" className={THUMB_CLASS} />

        <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              to={`/tours/${item.tourId}`}
              className="link-underline font-semibold text-base leading-snug text-ink hover:text-gold-ink lg:text-lg"
            >
              {tour.title}
            </Link>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-ink-muted">
              <KindChip kind={tour.kind} />
              <span>{formatDuration(tour.durationDays, tour.durationNights, locale)}</span>
            </div>
          </div>
          {/* 36px visible, 44px tap target via the invisible expander — the same trick the header
              controls use. */}
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            disabled={disabled}
            aria-label={t('cart.line.remove')}
            className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors before:absolute before:-inset-1 before:content-[''] hover:bg-danger-soft hover:text-danger focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            <TrashIcon size={17} />
          </button>
        </div>
      </div>

      {/*
        Controls sit BELOW the thumbnail row rather than beside it: at 375px a 72px cover and a
        full-width date field cannot share a line, and reflowing them per breakpoint would give a
        screen reader two different DOM orders for the same row.

        While a request is in flight the whole group is dimmed and inert — the position must not
        change between being sent and being answered. No spinner: the button's own label already
        says "Отправляем…", and a second indicator would only make the page busier.
      */}
      <div
        className={`mt-3 flex flex-wrap items-end gap-3 lg:mt-3.5 lg:gap-4 ${
          disabled ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        <div className="w-full sm:w-auto">
          <label htmlFor={dateFieldId} id={dateLabelId} className="block text-xs text-ink-muted">
            {t('booking.dateLabel')}
          </label>
          <DatePicker
            id={dateFieldId}
            value={item.tourDate}
            onChange={(value) => onChangeDate(item.id, value)}
            max={bookingWindow.toISO}
            disabledDates={disabledDates}
            discountRange={discountRange}
            error={dateInvalid}
            disabled={disabled}
            surface="public"
            aria-labelledby={dateLabelId}
            aria-describedby={message !== null ? errorId : undefined}
            className="mt-1.5 w-full sm:w-[216px]"
          />
        </div>

        <div>
          <span className="block text-xs text-ink-muted">{t('booking.guests')}</span>
          <div className="mt-1.5">
            <GuestStepper
              value={item.guestCount}
              onChange={(value) => onChangeGuests(item.id, value)}
              size="sm"
              disabled={disabled}
              labelFewer={t('booking.guestsFewer')}
              labelMore={t('booking.guestsMore')}
            />
          </div>
        </div>

        {/* `aria-live`: crossing 6→7 with the stepper swaps a price for a sentence — that has to be
            announced, not silently substituted. */}
        <div
          aria-live="polite"
          className="flex w-full items-baseline justify-between gap-3 border-t border-edge pt-2.5 sm:ml-auto sm:w-auto sm:justify-end sm:border-0 sm:pt-0"
        >
          {price.hidden ? (
            <p className="max-w-[44ch] text-[13.5px] leading-relaxed text-ink-dim sm:text-right">
              {largeGroupInvitation}
            </p>
          ) : (
            <>
              <span className="text-xs text-ink-muted sm:hidden">{t('cart.line.price')}</span>
              <span className="flex flex-col items-end">
                {price.originalTotal !== null && (
                  <span className="text-xs text-ink-muted line-through">{price.originalTotal}</span>
                )}
                <span className="font-semibold text-xl tabular-nums text-gold-ink">{price.total}</span>
                {tour.requiresPrepayment && price.prepayment !== null && (
                  <span className="text-xs text-ink-muted">
                    {t('booking.prepayment')} {price.prepayment}
                  </span>
                )}
              </span>
            </>
          )}
        </div>
      </div>

      {/* The reason sits UNDER the fields, not above the title: the visitor does not need to
          "learn about an error", they need to fix one specific field — so the sentence hangs
          exactly where their hand is going. */}
      {message !== null && (
        <p id={errorId} role="alert" className="mt-3 flex items-start gap-2 text-[13.5px] font-medium text-danger">
          <span className="mt-0.5 shrink-0">
            <AlertIcon size={16} />
          </span>
          {message}
        </p>
      )}
    </article>
  )
}
