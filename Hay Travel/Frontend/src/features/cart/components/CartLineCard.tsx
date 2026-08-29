import { useId } from 'react'
import { Link } from 'react-router'
import type { BookingWindow } from '@/shared/booking'
import {
  discountedPriceOn,
  MAX_GUESTS,
  PREPAYMENT_SHARE,
  resolveBasePrice,
  useTierPrice,
} from '@/shared/booking'
import type { CartItem } from '@/shared/cart'
import type { TourDetail } from '@/shared/types/tour'
import type { TransferDetail } from '@/shared/types/transfer'
import { TourFormat } from '@/shared/types/tourFormat'
import { useMoney } from '@/shared/currency'
import { formatDuration, formatShortDate } from '@/shared/lib/format'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { DatePicker, FormatChip, GuestStepper, KindChip, type DatePickerDiscountRange } from '@/shared/ui'
import { AlertIcon, CarIcon, ClockIcon, TrashIcon } from '@/shared/ui/icons'
import { lineFailureMessage, type CheckoutLineFailureReason } from '../lib/checkoutErrors'
import type { CartLineState } from '../lib/cartLine'

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
  /** `undefined` — тур не отдался бэкендом; строка рендерится в режиме «недоступен» (§6.3).
   * У позиции-трансфера всегда `undefined`: её продукт лежит в `transfer`. */
  tour: TourDetail | undefined
  /** Продукт позиции-ТРАНСФЕРА (`item.transfer !== null`), `undefined` — не отдался бэкендом. */
  transfer: TransferDetail | undefined
  /** Закрытые дни этого тура (из loader) + даты, отклонённые сервером в этой сессии (§7.5). */
  disabledDates: ReadonlySet<string>
  window: BookingWindow
  largeGroupInvitation: string
  /** Причина, по которой сервер отклонил именно эту позицию на последней попытке (§6.4).
   *  `null` — позиция в порядке. */
  error: CheckoutLineFailureReason | null
  /** Формат позиции + свободные места на её выезд, посчитанные один раз в `CartPage`
   * (`resolveCartLine`) — строка и кнопка отправки обязаны видеть одно и то же. */
  line: CartLineState
  /** Идёт запрос — вся строка недоступна для редактирования. */
  disabled: boolean
  onChangeDate: (itemId: string, date: string) => void
  onChangeGuests: (itemId: string, guests: number) => void
  onRemove: (itemId: string) => void
}

const THUMB_CLASS = 'h-18 w-18 shrink-0 rounded-xl object-cover lg:h-21 lg:w-28'

export function CartLineCard(props: CartLineCardProps) {
  /* Три ветки, а не одна с ранними возвратами: цена — это ХУК (`useTierPrice`), и ветвление
     внутри одного компонента поставило бы список хуков в зависимость от того, что вернул loader.
     Граница компонента — единственное место, где React разрешает два разных списка хуков. */
  if (props.item.transfer !== null) {
    return props.transfer === undefined ? (
      <UnavailableLine
        item={props.item}
        disabled={props.disabled}
        onRemove={props.onRemove}
        transferKind
      />
    ) : (
      <TransferLine {...props} transfer={props.transfer} />
    )
  }

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
  transferKind = false,
}: Pick<CartLineCardProps, 'item' | 'disabled' | 'onRemove'> & { transferKind?: boolean }) {
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
            {transferKind ? t('cart.line.transferUnavailable') : t('cart.line.unavailable')}
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
  line,
  disabled,
  onChangeDate,
  onChangeGuests,
  onRemove,
}: CartLineCardProps & { tour: TourDetail }) {
  const { locale, t } = useLocale()
  const money = useMoney()
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
     position always has a date, so there is no "today" fallback branch here.

     База зависит от формата позиции (за бронь или за человека) — `resolveBasePrice`. Формат
     `null` (продукт стал «обоими» после добавления) считается по индивидуальному ТОЛЬКО чтобы
     хук получил валидный аргумент: цена в этом случае не рисуется вовсе, строка показывает
     требование выбрать формат. */
  const format = line.format ?? TourFormat.Individual
  const basePrice = resolveBasePrice(format, tour.priceFrom, tour.groupPricePerPerson)
  const discountedForDate = discountedPriceOn(basePrice, tour.discountWindow, item.tourDate)
  const price = useTierPrice(basePrice, item.guestCount, discountedForDate, format)
  const showPrice = line.format !== null

  /* Отказ сервера с прошлой попытки и клиентская проблема позиции (места/формат) — одно и то
     же место на экране: и то, и другое чинится правкой ЭТОЙ строки. Серверный приоритетнее —
     он свежее и конкретнее. */
  const message =
    error !== null
      ? lineFailureMessage(error, t)
      : line.issue === 'noSeats'
        ? t('booking.noSeats')
        : line.issue === 'notEnoughSeats'
          ? t('booking.notEnoughSeats', { count: line.seatsLeft ?? 0 })
          : line.issue === 'formatRequired'
            ? t('booking.formatRequired')
            : null
  // Only a date-shaped rejection paints the calendar red — a guest-count problem is not the date's
  // fault, and colouring the wrong field sends the visitor to fix the wrong thing. Нехватка мест
  // и пропавшая дата — про календарь одинаково: и то, и другое чинится другой датой.
  const dateInvalid = error === 'dateUnavailable' || error === 'datePast' || line.issue === 'noSeats'

  return (
    <article
      className={[
        'rounded-2xl bg-panel p-4 ring-1 lg:p-5',
        // Outlined, never filled: a list of four rejected rows would otherwise read as a traffic
        // light instead of a list.
        message === null ? 'ring-edge' : 'ring-danger/50',
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
            {/* Формат подписан ФАКТИЧЕСКИЙ (`line.format`), а не «оба» продукта: в корзине
                лежит уже сделанный выбор, и показывать здесь витринный бейдж значило бы скрыть
                от посетителя, по какому тарифу посчитана его строка. */}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-ink-muted">
              <KindChip kind={tour.kind} />
              <FormatChip format={line.format} tone="surface" />
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

        {/* Время выезда — ТОЛЬКО показ, без редактора. Расписание принадлежит продукту, а не
            дате, поэтому другое время — это другой выезд (со своими местами), и выбирается он
            там же, где выбирался: в блоке брони. Но не показать его нельзя: две позиции одного
            тура на один день без времени выглядели бы дублем. */}
        <div>
          <span className="block text-xs text-ink-muted">{t('cart.line.startTime')}</span>
          <p className="mt-1.5 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-panel-raised px-3 text-sm tabular-nums text-ink ring-1 ring-edge">
            <span className="shrink-0 text-ink-muted">
              <ClockIcon size={14} />
            </span>
            {item.startTime}
          </p>
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
          {/* Формат не разрешается — цены нет. Не «0» и не цена по чужому тарифу: строку
              всё равно нельзя отправить, а неверная цифра пережила бы этот экран в памяти
              посетителя. Что делать, говорит сообщение ниже. */}
          {!showPrice ? null : price.hidden ? (
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
                {/* «X за человека» — только у групповой строки: без неё сумма, которая растёт
                    вместе со счётчиком гостей, выглядит как ошибка на фоне индивидуальных
                    строк, где она от гостей не зависит. */}
                {line.format === TourFormat.Group && (
                  <span className="text-xs text-ink-dim">
                    {t('booking.perPerson', { price: money.format(discountedForDate ?? basePrice) })}
                  </span>
                )}
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

/* ── Строка ПРЕДОПРЕДЕЛЁННОГО ТРАНСФЕРА (решение 0.10, батч 2026-08-29) ────────────────────────
   Отдельный компонент, а не флаги внутри `AvailableLine`: у трансфера нет ни формата, ни тира по
   гостям, ни скидки, ни длительности — общего с бронью продукта у него только «картинка, дата,
   счётчик и цена справа».

   ЧТО ПРАВИТСЯ ЗДЕСЬ, а что нет:
    - дата поездки и число пассажиров — правятся: это единственные два поля, которые не меняют
      того, из чего складывается цена машины;
    - время подачи, класс авто и обратный рейс — только показываются. Класс это цена, а обратный
      рейс это вторая цена; менять их надо там, где обе цены видны рядом, — на странице трансфера.
      Показывать их обязательно: без них две позиции одного трансфера на один день выглядели бы
      дублем. */
function TransferLine({
  item,
  transfer,
  disabledDates,
  window: bookingWindow,
  error,
  line,
  disabled,
  onChangeDate,
  onChangeGuests,
  onRemove,
}: CartLineCardProps & { transfer: TransferDetail }) {
  const { locale, t } = useLocale()
  const money = useMoney()
  const dateFieldId = useId()
  const dateLabelId = useId()
  const errorId = `${dateFieldId}-error`

  const selection = item.transfer
  const vehicle = line.vehicle
  const price =
    vehicle === null ? null : selection?.isRoundTrip ? vehicle.roundTripPrice : vehicle.oneWayPrice

  const message =
    error !== null
      ? lineFailureMessage(error, t)
      : line.issue === 'vehicleUnavailable'
        ? t('transfers.error.vehicle')
        : line.issue === 'passengersOverCapacity'
          ? t('transfers.error.passengers')
          : line.issue === 'returnTripInvalid'
            ? t('transfers.error.returnTrip')
            : null

  const dateInvalid =
    error === 'dateUnavailable' || error === 'datePast' || line.issue === 'returnTripInvalid'

  return (
    <article
      className={[
        'rounded-2xl bg-panel p-4 ring-1 lg:p-5',
        message === null ? 'ring-edge' : 'ring-danger/50',
      ].join(' ')}
    >
      <div className="flex gap-3 lg:gap-4">
        <img
          src={transfer.coverImage || item.snapshot.coverImage}
          alt=""
          loading="lazy"
          className={THUMB_CLASS}
        />

        <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              to={`/transfers/${item.tourId}`}
              className="link-underline font-semibold text-base leading-snug text-ink hover:text-gold-ink lg:text-lg"
            >
              {transfer.title}
            </Link>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-ink-muted">
              <KindChip kind="transfer" />
              {vehicle !== null && (
                <span className="inline-flex items-center gap-1.5">
                  <CarIcon size={13} />
                  {vehicle.name}
                </span>
              )}
              <span>
                {selection?.isRoundTrip ? t('cart.line.return') : t('cart.line.oneWay')}
              </span>
            </div>
          </div>
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

      <div
        className={`mt-3 flex flex-wrap items-end gap-3 lg:mt-3.5 lg:gap-4 ${
          disabled ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        <div className="w-full sm:w-auto">
          <label htmlFor={dateFieldId} id={dateLabelId} className="block text-xs text-ink-muted">
            {t('transfers.detail.dateLabel')}
          </label>
          <DatePicker
            id={dateFieldId}
            value={item.tourDate}
            onChange={(value) => onChangeDate(item.id, value)}
            max={bookingWindow.toISO}
            disabledDates={disabledDates}
            error={dateInvalid}
            disabled={disabled}
            surface="public"
            aria-labelledby={dateLabelId}
            aria-describedby={message !== null ? errorId : undefined}
            className="mt-1.5 w-full sm:w-[216px]"
          />
        </div>

        <div>
          <span className="block text-xs text-ink-muted">{t('cart.line.pickupTime')}</span>
          <p className="mt-1.5 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-panel-raised px-3 text-sm tabular-nums text-ink ring-1 ring-edge">
            <span className="shrink-0 text-ink-muted">
              <ClockIcon size={14} />
            </span>
            {item.startTime}
          </p>
        </div>

        {/* Обратный рейс показывается ЦЕЛИКОМ (дата + время) — в том числе потому, что смена
            даты «туда» может подтянуть его вперёд (см. `updateCartItem`), и посетитель обязан
            увидеть, во что превратился его выбор. */}
        {selection?.isRoundTrip && selection.returnDate !== null && (
          <div>
            <span className="block text-xs text-ink-muted">{t('cart.line.return')}</span>
            <p className="mt-1.5 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-panel-raised px-3 text-sm text-ink ring-1 ring-edge">
              {formatShortDate(selection.returnDate, locale)}
              <span className="tabular-nums text-ink-dim">{selection.returnTime}</span>
            </p>
          </div>
        )}

        <div>
          <span className="block text-xs text-ink-muted">{t('cart.line.passengers')}</span>
          <div className="mt-1.5">
            <GuestStepper
              value={item.guestCount}
              onChange={(value) => onChangeGuests(item.id, value)}
              min={1}
              /* Потолок — вместимость выбранной машины, но не выше `MAX_GUESTS`: у строки ПО
                 ПРОДУКТУ бэк держит оба предела (2049 и 2015), и класс на 20 мест не делает
                 бронь на 18 человек возможной. Пока класс не разрешился, остаётся только общий
                 предел. */
              max={vehicle === null ? MAX_GUESTS : Math.min(vehicle.capacity, MAX_GUESTS)}
              size="sm"
              disabled={disabled}
              valueLabel={t('cart.line.passengers')}
              labelFewer={t('transfers.detail.passengersFewer')}
              labelMore={t('transfers.detail.passengersMore')}
            />
          </div>
        </div>

        <div className="flex w-full items-baseline justify-between gap-3 border-t border-edge pt-2.5 sm:ml-auto sm:w-auto sm:justify-end sm:border-0 sm:pt-0">
          <span className="text-xs text-ink-muted sm:hidden">{t('cart.line.price')}</span>
          <span className="flex flex-col items-end">
            {/* Цены нет, только когда класс авто перестал продаваться: показывать «0» вместо неё
                нельзя — строку всё равно нельзя отправить, а неверная цифра пережила бы экран. */}
            <span className="font-semibold text-xl tabular-nums text-gold-ink">
              {price === null ? '—' : money.format(price)}
            </span>
            <span className="text-xs text-ink-muted">{t('transfers.pricePerCar')}</span>
            {transfer.requiresPrepayment && price !== null && (
              <span className="text-xs text-ink-muted">
                {t('booking.prepayment')} {money.format(Math.round(price * PREPAYMENT_SHARE))}
              </span>
            )}
          </span>
        </div>
      </div>

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
