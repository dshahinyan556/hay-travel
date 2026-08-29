import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router'
import type { TourDetail, TourStartTime } from '@/shared/types/tour'
import type { TourGroupSeatsModel } from '@/shared/types/booking'
import { TourFormat, type EffectiveTourFormat } from '@/shared/types/tourFormat'
import { addCartItem } from '@/shared/cart'
import {
  discountedPriceOn,
  getBookingWindow,
  MAX_GUESTS,
  MIN_GUESTS,
  resolveBasePrice,
  resolveEffectiveFormat,
  seatsLeftOn,
  useTierPrice,
} from '@/shared/booking'
import { parseISODate } from '@/shared/lib/date'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { useMoney } from '@/shared/currency'
import { DatePicker, GuestStepper, type DatePickerDiscountRange } from '@/shared/ui'
import { AlertIcon, CheckIcon, GuideIcon } from '@/shared/ui/icons'
import { FormatChoice } from './FormatChoice'
import { StartTimePicker, type StartTimeOption } from './StartTimePicker'

/**
 * Booking box — picks a trip date, a departure slot and a guest count and puts THAT choice into
 * the cart (`shared/cart`, ADR 022). It no longer creates an order.
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
 *
 * ── Формат, время старта и места (батч 2026-08-29, решения 0.16-0.21) ─────────────────────────
 * Три новых обязательства, и все три — контракт с бэком, а не оформление:
 *  1. ВРЕМЯ ВЫЕЗДА обязательно и выбирается только из расписания продукта. Кнопка заблокирована,
 *     пока слот не выбран; чужое значение сервер отбивает (`InvalidStartTimeSelection`/2045).
 *     Расписание может оказаться пустым (запись, до которой не дошла миграция) — тогда карточка
 *     говорит «записаться пока нельзя» вместо пустого списка кнопок.
 *  2. ФОРМАТ: продукт может продаваться индивидуально, группой или и так, и так. В последнем
 *     случае выбирает посетитель, и от выбора зависит ТАРИФ — `useTierPrice` получает и другую
 *     базовую цену (за человека вместо за бронь), и другую ветку расчёта.
 *  3. МЕСТА: у группового формата ограничитель — свободные места на пару (дата + время). Ноль
 *     мест гасит слот, нехватка мест под текущее число гостей блокирует кнопку. Сервер
 *     проверяет то же самое (`NoSeatsLeft`/2044) — здесь это UX, а не защита.
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

/**
 * Стартовое время: из `?time=HH:mm` (тот же одноразовый deep link, что `?date=`/`?guests=`),
 * иначе — единственный слот расписания, если он один.
 *
 * Автовыбор ровно при ОДНОМ слоте, и это не «удобная подстановка по умолчанию»: когда вариант
 * один, выбора не существует, и требовать тап по единственной кнопке — работа ради работы.
 * При двух и более слотах поле остаётся пустым, потому что за посетителя выбирать выезд нельзя.
 */
function initialStartTime(startTimes: readonly TourStartTime[]): string {
  const raw = new URLSearchParams(location.search).get('time')
  if (raw !== null && startTimes.some((startTime) => startTime.time === raw)) return raw
  return startTimes.length === 1 ? startTimes[0].time : ''
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
  /**
   * Занятость выездов группового формата на всё окно бронирования; `null` — запрос не удался
   * (доступность не роняет страницу) либо продукт не групповой. `null` означает «не мешать»:
   * места всё равно перепроверит сервер при создании заказа.
   */
  groupSeats: TourGroupSeatsModel | null
}

export function BookingCard({ tour, largeGroupInvitation, closedDates, groupSeats }: BookingCardProps) {
  const dateFieldId = useId()
  const dateLabelId = useId()
  const timeLabelId = useId()
  const formatLabelId = useId()
  const dateErrorId = `${dateFieldId}-error`
  const seatsErrorId = `${dateFieldId}-seats`
  const { t } = useLocale()
  const money = useMoney()

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
  const [startTime, setStartTime] = useState(() => initialStartTime(tour.startTimes))
  /*
    Формат, выбранный посетителем. Значим ТОЛЬКО у продукта с `Both` — у остальных он не
    показывается и не отправляется.

    Стартовое значение — индивидуальный: это исторический тариф всех продуктов до батча и
    поведение бэка для формата, который не выбран у не-`Both` продукта. Пустого начального
    состояния здесь нет намеренно: без формата не существует цены, а карточка, открывающаяся
    без главной цифры, — это худший из вариантов для страницы, которая продаёт.
  */
  const [chosenFormat, setChosenFormat] = useState<EffectiveTourFormat>(TourFormat.Individual)
  // The date field used to be an `<input type="date" required>`, where the browser blocked submit
  // on its own. `DatePicker`'s trigger is a `<button>`, which no form validation applies to, so
  // that guard now lives here — otherwise an empty date would silently reach the cart.
  const [dateMissing, setDateMissing] = useState(false)
  const [added, setAdded] = useState<'added' | 'updated' | null>(null)
  const [cartFull, setCartFull] = useState(false)

  const isBoth = tour.format === TourFormat.Both
  /* `?? Individual` недостижим: `chosenFormat` уже сужен до Individual|Group, а не-`Both`
     продукт разрешается своим собственным форматом. Подстраховка ровно та же, что у бэка,
     где `null` значит «клиент обязан был выбрать» (`OrderLineFormatRequired`/2046). */
  const format = resolveEffectiveFormat(tour.format, chosenFormat) ?? TourFormat.Individual
  const isGroupFormat = format === TourFormat.Group

  const hasSchedule = tour.startTimes.length > 0

  /* Свободные места на КАЖДЫЙ слот выбранной даты — и подпись на кнопке времени, и причина
     её блокировки. Только у группового формата: индивидуальный ограничителя по местам не
     имеет вовсе (`seatsLeftOn` вернёт `null` и сам, но лишний проход по слотам ни к чему).

     `date`/`groupSeats`/`format` — весь набор входов, поэтому мемо честное: пересчитывается
     ровно тогда, когда меняется картина занятости, а не на каждый тик счётчика гостей. */
  const startTimeOptions = useMemo<StartTimeOption[]>(
    () =>
      tour.startTimes.map((slot) => {
        const seatsLeft = isGroupFormat ? seatsLeftOn(groupSeats, date, slot.time) : null
        return { ...slot, seatsLeft, disabled: seatsLeft === 0 }
      }),
    [tour.startTimes, isGroupFormat, groupSeats, date],
  )

  const seatsLeft = isGroupFormat ? seatsLeftOn(groupSeats, date, startTime) : null
  const soldOut = seatsLeft === 0
  const notEnoughSeats = seatsLeft !== null && seatsLeft > 0 && guests > seatsLeft
  const seatsMessage = soldOut
    ? t('booking.noSeats')
    : notEnoughSeats
      ? t('booking.notEnoughSeats', { count: seatsLeft })
      : null

  /* Ключевая цифра карточки. Базовая цена зависит от формата (за бронь или за человека), и
     подменить одну другой нельзя — у продукта с `Both` настоящие обе. */
  const basePrice = resolveBasePrice(format, tour.priceFrom, tour.groupPricePerPerson)

  /* Before a date is picked there is nothing to resolve against, so the card keeps showing the
     server's "today" figure — the same number the catalog card and the page header show. Once a
     date exists, the discount follows THAT date, exactly like the order the backend will create
     (see `shared/booking/tourDiscount.ts`).

     У группового формата серверной «цены на сегодня» не существует (`discountedPrice` посчитан
     от цены за бронь), поэтому его скидка резолвится на дату — а до выбора даты на сегодняшнюю
     (`bookingWindow.fromISO` и есть сегодня). Ровно та же арифметика, что делает бэк, только
     от другой базы. */
  const discountedForDate = isGroupFormat
    ? discountedPriceOn(basePrice, tour.discountWindow, date === '' ? bookingWindow.fromISO : date)
    : date === ''
      ? tour.discountedPrice
      : discountedPriceOn(tour.priceFrom, tour.discountWindow, date)

  const price = useTierPrice(basePrice, guests, discountedForDate, format)
  /* «X за человека» — вторая строка группового итога. Показывает, из чего сложилась сумма;
     умножение на гостей посетитель делает глазами, и цифра обязана сходиться с итогом. */
  const perPersonLabel = isGroupFormat
    ? t('booking.perPerson', { price: money.format(discountedForDate ?? basePrice) })
    : null

  const timeMissing = hasSchedule && startTime === ''
  const submitBlocked = timeMissing || soldOut || notEnoughSeats

  /** Любая правка выезда обесценивает подтверждение «добавлено»: оно относилось к прежней
   * позиции, а не к той, что собрана сейчас. */
  function resetFeedback() {
    setAdded(null)
    setCartFull(false)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (date === '') {
      setDateMissing(true)
      return
    }
    // Недостижимо через UI (кнопка заблокирована), но это последняя точка перед записью в
    // корзину — позиция без слота не должна существовать даже теоретически.
    if (submitBlocked) return

    setCartFull(false)
    const result = addCartItem({
      tourId: Number(tour.id),
      tourDate: date,
      guestCount: guests,
      startTime,
      // Формат уезжает в корзину, только если он ВЫБОР. У продукта с одним форматом это
      // «нечего выбирать», и `null` здесь означает ровно то же, что на бэке.
      format: isBoth ? chosenFormat : null,
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
            {perPersonLabel !== null && <p className="mt-0.5 text-xs text-ink-dim">{perPersonLabel}</p>}
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
        {/* «Малая группа» — обещание индивидуального формата (едет только ваша компания). У
            группового оно неверно по смыслу, поэтому чип там не показывается. */}
        {!price.hidden && !isGroupFormat && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-panel-raised px-2.5 py-1 text-xs text-ink-dim ring-1 ring-edge">
            <GuideIcon size={13} />
            {t('booking.smallGroup')}
          </span>
        )}
      </div>

      {/* Формат стоит ПЕРВЫМ из полей: он меняет и цену выше, и смысл всего, что ниже (в
          групповом формате у слотов появляются места). Показывается только при `Both`. */}
      {isBoth && (
        <div className="mt-4">
          <span id={formatLabelId} className="block text-xs text-ink-muted">
            {t('booking.formatLabel')}
          </span>
          <div className="mt-1.5">
            <FormatChoice
              value={chosenFormat}
              onChange={(next) => {
                setChosenFormat(next)
                resetFeedback()
              }}
              labelledBy={formatLabelId}
            />
          </div>
        </div>
      )}

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
            resetFeedback()
          }}
          max={bookingWindow.toISO}
          disabledDates={disabledDates}
          discountRange={
            tour.discountWindow === null
              ? null
              : ({
                  start: tour.discountWindow.startDate,
                  end: tour.discountWindow.endDate,
                  percent: tour.discountWindow.percent,
                } satisfies DatePickerDiscountRange)
          }
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

      {/* Время выезда. Пустое расписание — не пустой список кнопок, а прямой ответ «записаться
          пока нельзя»: у продукта, до которого не дошла миграция времён, выбирать нечего. */}
      <div className="mt-3">
        <span id={timeLabelId} className="block text-xs text-ink-muted">
          {t('booking.startTimeLabel')}
        </span>
        {hasSchedule ? (
          <div className="mt-1.5">
            <StartTimePicker
              options={startTimeOptions}
              value={startTime}
              onChange={(value) => {
                setStartTime(value)
                resetFeedback()
              }}
              labelledBy={timeLabelId}
              describedBy={seatsMessage !== null ? seatsErrorId : undefined}
            />
          </div>
        ) : (
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-dim">
            {t('booking.startTimeUnavailable')}
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
            onChange={(value) => {
              setGuests(value)
              resetFeedback()
            }}
            labelFewer={t('booking.guestsFewer')}
            labelMore={t('booking.guestsMore')}
          />
        </div>
      </div>

      {/* Мест нет / мест меньше, чем гостей. `role="alert"` — сообщение появляется в ответ на
          действие (смена даты, слота или числа гостей), а не при загрузке страницы. */}
      {seatsMessage !== null && (
        <p
          id={seatsErrorId}
          role="alert"
          className="mt-3 flex items-start gap-2 text-[13px] leading-snug font-medium text-danger"
        >
          <span className="mt-0.5 shrink-0">
            <AlertIcon size={15} />
          </span>
          {seatsMessage}
        </p>
      )}

      {hasSchedule &&
        (added === null ? (
          <>
            {/* Kept and ENABLED at 7+, and the label no longer changes with the tier either: the
                action is now "put this in the cart", which is the same action regardless of group
                size. Блокирует её только НЕВОЗМОЖНОСТЬ брони: не выбран слот либо мест не
                хватает — то, что сервер отбил бы 2044/2045. */}
            <button
              type="submit"
              disabled={submitBlocked}
              className="btn-sheen mt-5 w-full rounded-full bg-gold-fill px-5 py-3 text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t('cart.addToCart')}
            </button>

            {/* Stays directly under the button so the default state of the card is unchanged.
                Пока слот не выбран, здесь стоит именно это требование: кнопка заблокирована, и
                узнать причину из неё самой невозможно. Причина по местам уже выведена выше. */}
            <p className="mt-2.5 text-center text-xs text-ink-muted">
              {timeMissing
                ? t('booking.startTimeMissing')
                : price.hidden
                  ? t('booking.submitHintLargeGroup')
                  : t('booking.submitHint')}
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
        ))}
    </form>
  )
}
