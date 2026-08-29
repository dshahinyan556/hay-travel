import { useEffect, useMemo, useRef } from 'react'
import { useLoaderData, useRevalidator } from 'react-router'
import { getClosedDates, getGroupSeats } from '@/shared/api/booking'
import { getTourInfo } from '@/shared/api/tours'
import { getTransferInfo } from '@/shared/api/transfers'
import { getContentText, type ContentText } from '@/shared/api/siteSettings'
import { getBookingWindow, type BookingWindow } from '@/shared/booking'
import { getCartState, removeCartItem, updateCartItem, useCart } from '@/shared/cart'
import { useAuth } from '@/shared/auth'
import type { TourDetail } from '@/shared/types/tour'
import type { TransferDetail } from '@/shared/types/transfer'
import type { TourGroupSeatsModel } from '@/shared/types/booking'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { AlertIcon } from '@/shared/ui/icons'
import { CartEmptyState } from './components/CartEmptyState'
import { CartLineCard } from './components/CartLineCard'
import { CartSummary } from './components/CartSummary'
import { CheckoutResultPanel } from './components/CheckoutResultPanel'
import { resolveCartLine, resolveTransferCartLine, type CartLineState } from './lib/cartLine'
import { useCartTotal } from './hooks/useCartTotal'
import { useCheckout } from './hooks/useCheckout'

/**
 * `/cart` — the accumulated trip requests, and the ONE place on the public site that creates an
 * order (ADR 022 / ADR 025).
 *
 * No route guard: an anonymous visitor must be able to see their own cart. Signing in is asked for
 * at the moment of sending and nowhere earlier.
 *
 * This component is the only owner of cart mutations. Rows are dumb; every date/guest edit and
 * every removal comes back up here, so two rows of the same tour can never write conflicting
 * state and the server-rejected days stay attached to the TOUR rather than to a row.
 */

export interface CartLoaderData {
  /** Ключ — String(tourId). Отсутствие ключа = тур не найден на бэкенде (удалён/скрыт). */
  tours: Record<string, TourDetail>
  /** Ключ — String(tourId) позиции-трансфера. Трансфер это тот же `Tour` (решение 0.2), поэтому
   * id из одного пространства и коллизий с турами быть не может. Отдельная карта, а не общая:
   * у трансфера другая модель (`GetTransferInfo` вместо `GetTourInfo`), и склеивать их значило
   * бы завести тип с половиной всегда пустых полей. */
  transfers: Record<string, TransferDetail>
  /** Ключ — String(tourId). Закрытые дни в пределах окна бронирования; [] при сбое запроса. */
  closedDates: Record<string, readonly string[]>
  /** Ключ — String(tourId). Занятость выездов группового формата; `null` — запрос не удался
   * (значит «ограничитель неизвестен, не мешать» — сервер проверит места сам). */
  groupSeats: Record<string, TourGroupSeatsModel | null>
  /** Тексты сайта; несёт `largeGroupInvitation` для строк с 7+ гостями. */
  content: ContentText
  window: BookingWindow
}

/**
 * Reads the cart STORE directly — that is exactly why the store is a module and not a Context
 * (ADR 009's argument, reused): a route loader runs before anything is mounted.
 *
 * It deliberately does NOT re-run on an edit: `TourDetail` carries the whole `discountWindow` and
 * `closedDates` covers the entire three-month window, so the data already on hand answers any date
 * the visitor can pick. There is nothing to re-fetch.
 */
export async function cartLoader(): Promise<CartLoaderData> {
  const items = getCartState().items
  /* Позиции-трансферы отделяются СРАЗУ: `GetTourInfo` отвечает на трансфер 404 (решение 0.15),
     и спросить о нём «как о туре» значило бы получить «недоступен» на совершенно живой продукт. */
  const tourIds = [...new Set(items.filter((item) => item.transfer === null).map((item) => item.tourId))]
  const transferIds = [...new Set(items.filter((item) => item.transfer !== null).map((item) => item.tourId))]
  const window = getBookingWindow()

  const [content, resolved, resolvedTransfers] = await Promise.all([
    // Fetched even for an empty cart: one cheap request buys the page a single data contract with
    // no nullable branch. It never rejects, by its own contract.
    getContentText(),
    Promise.all(
      tourIds.map(async (tourId) => {
        const [tour, closed, seats] = await Promise.all([
          // `undefined` (404 — hidden or deleted) must NOT take the page down: that position
          // simply renders as "unavailable". Same contract as `tourDetailLoader`.
          getTourInfo(String(tourId)),
          // Availability likewise never takes a page down — losing the list only means the server
          // gets to reject the day on submit instead.
          getClosedDates(tourId, window.fromISO, window.toISO).catch(() => [] as string[]),
          /* Места запрашиваются БЕЗУСЛОВНО, а не «только для групповых»: формат продукта
             известен лишь после `getTourInfo`, и ждать его значило бы выстроить два запроса
             в цепочку вместо параллели. У негруппового продукта ответ пустой и дешёвый. */
          getGroupSeats(tourId, window.fromISO, window.toISO).catch(() => null),
        ])
        return { tourId, tour, closed, seats }
      }),
    ),
    Promise.all(
      transferIds.map(async (tourId) => {
        // Мест у трансфера нет — ограничитель это вместимость машины, и она приезжает вместе с
        // классами. Поэтому запросов два, а не три.
        const [transfer, closed] = await Promise.all([
          getTransferInfo(String(tourId)),
          getClosedDates(tourId, window.fromISO, window.toISO).catch(() => [] as string[]),
        ])
        return { tourId, transfer, closed }
      }),
    ),
  ])

  const tours: Record<string, TourDetail> = {}
  const transfers: Record<string, TransferDetail> = {}
  const closedDates: Record<string, readonly string[]> = {}
  const groupSeats: Record<string, TourGroupSeatsModel | null> = {}
  for (const entry of resolved) {
    if (entry.tour) tours[String(entry.tourId)] = entry.tour
    closedDates[String(entry.tourId)] = entry.closed
    groupSeats[String(entry.tourId)] = entry.seats
  }
  for (const entry of resolvedTransfers) {
    if (entry.transfer) transfers[String(entry.tourId)] = entry.transfer
    closedDates[String(entry.tourId)] = entry.closed
  }

  return { tours, transfers, closedDates, groupSeats, content, window }
}

export function CartPage() {
  const {
    tours,
    transfers,
    closedDates,
    groupSeats,
    content,
    window: bookingWindow,
  } = useLoaderData() as CartLoaderData
  const { items } = useCart()
  const { status: authStatus } = useAuth()
  const { t } = useLocale()
  const { revalidate } = useRevalidator()

  const checkout = useCheckout()
  const { total, originalTotal, hasQuoteOnlyLines } = useCartTotal(items, tours, transfers)

  /** Есть ли у позиции её продукт — единственное место, где это решается: у брони это `tours`,
   * у трансфера `transfers`, и перепутать карты нельзя (`GetTourInfo` на трансфер отвечает 404). */
  const isResolved = (item: (typeof items)[number]) =>
    item.transfer === null
      ? String(item.tourId) in tours
      : String(item.tourId) in transfers

  /* The total is captured at the MOMENT OF SENDING, because a success clears the cart and there is
     no longer anything to sum by the time the result panel renders. Taken in the click handler
     rather than derived per render on purpose: deriving it would depend on `clearCart()` and
     `setResult()` landing in the same React batch, which is true today and is not a guarantee
     worth resting a visible number on. A ref, not state — nothing re-renders because of it. */
  const submittedTotalRef = useRef<string | null>(null)

  /**
   * A position added from ANOTHER TAB after this page loaded has no `TourDetail` here. Refetching
   * is the fix, but only ONCE per tour: a tour the backend genuinely does not serve would
   * otherwise revalidate forever, so every id we have already asked about is remembered.
   */
  const askedRef = useRef<Set<number>>(new Set())
  useEffect(() => {
    /* Проверка развёрнута ЗДЕСЬ, а не через `isResolved` выше: та функция пересоздаётся каждый
       рендер, и в списке зависимостей она гоняла бы эффект вхолостую на каждое нажатие счётчика
       гостей. Обе карты продуктов в зависимостях, поэтому свежесть данных не теряется. */
    const unknown = items.filter((item) => {
      const key = String(item.tourId)
      const resolved = item.transfer === null ? key in tours : key in transfers
      return !resolved && !askedRef.current.has(item.tourId)
    })
    if (unknown.length === 0) return
    for (const item of unknown) askedRef.current.add(item.tourId)
    void revalidate()
  }, [items, tours, transfers, revalidate])

  /* Disabled days per tour: what the loader knew plus what the server rejected in this session.
     Memoized because `DatePicker.disabledDates` feeds its own `isDisabledDate` memo — a fresh Set
     each render would defeat it on every row at once.

     Keyed on the tour ids, NOT on `items`: a guest-count edit produces a new `items` array but
     cannot change which days are closed, and rebuilding every Set for it would re-run the memo
     inside every calendar on the page. */
  const tourIdKey = items.map((item) => item.tourId).join(',')
  const disabledByTour = useMemo(() => {
    const map = new Map<string, ReadonlySet<string>>()
    for (const key of tourIdKey === '' ? [] : tourIdKey.split(',')) {
      if (map.has(key)) continue
      map.set(key, new Set([...(closedDates[key] ?? []), ...(checkout.serverClosed[key] ?? [])]))
    }
    return map
  }, [tourIdKey, closedDates, checkout.serverClosed])

  /* Формат и места считаются здесь, а не в строке: по ним же решается, блокировать ли кнопку
     отправки, и два независимых расчёта рано или поздно разошлись бы (красная строка при
     активной кнопке). Позиции без продукта в карте не будет — её строка рисуется в режиме
     «недоступна» и блокирует отправку сама. */
  const lineStates = new Map<string, CartLineState>()
  for (const item of items) {
    if (item.transfer !== null) {
      const transfer = transfers[String(item.tourId)]
      if (!transfer) continue
      lineStates.set(item.id, resolveTransferCartLine(item, transfer))
      continue
    }
    const tour = tours[String(item.tourId)]
    if (!tour) continue
    lineStates.set(item.id, resolveCartLine(item, tour, groupSeats[String(item.tourId)] ?? null))
  }

  const hasUnavailableTour = items.some((item) => !isResolved(item))
  /* Мест не хватает / формат не выбран — сервер отбил бы такой заказ целиком (2044/2046), а
     отказ атомарный: одна битая позиция уносит всю корзину. Поэтому кнопка гасится ЗАРАНЕЕ. */
  const hasLineIssues = items.some((item) => lineStates.get(item.id)?.issue != null)
  // Read off the ITEMS, not off the error map's size: editing a date changes a position's id, so a
  // stale key could otherwise keep the button disabled with nothing visibly marked.
  const hasLineErrors = items.some((item) => checkout.lineErrors.has(item.id))
  const sessionUnknown = authStatus !== 'authenticated' && authStatus !== 'anonymous'

  const blockedBy = hasUnavailableTour
    ? 'unavailableTour'
    : hasLineErrors
      ? 'lineErrors'
      : hasLineIssues
        ? 'lineIssues'
        : sessionUnknown
          ? 'sessionUnknown'
          : null

  /* Any edit clears that row's mark — otherwise the submit button would stay blocked forever. The
     old id is used deliberately: changing the date rebuilds the id, and the entry filed under the
     previous one has to go with it. */
  const handleChangeDate = (itemId: string, date: string) => {
    checkout.clearLineError(itemId)
    updateCartItem(itemId, { tourDate: date })
  }

  const handleChangeGuests = (itemId: string, guests: number) => {
    checkout.clearLineError(itemId)
    updateCartItem(itemId, { guestCount: guests })
  }

  const handleRemove = (itemId: string) => {
    checkout.clearLineError(itemId)
    removeCartItem(itemId)
  }

  const handleSubmit = () => {
    submittedTotalRef.current = total
    void checkout.submit(items)
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-8 pb-14 sm:px-6 sm:pt-10">
      <header className="pb-4 sm:pb-5">
        <h1 className="font-display text-[26px] leading-tight text-ink sm:text-[34px]">
          {t('cart.title')}
        </h1>
        {checkout.result === null && items.length > 0 && (
          <p className="mt-2 text-[13px] text-ink-muted sm:text-sm">{t('cart.subtitle')}</p>
        )}
      </header>

      {/* Priority is deliberate: the cart is ALREADY empty when a checkout succeeds, so the result
          has to outrank the empty state or the visitor would never see their order number. */}
      {checkout.result !== null ? (
        <CheckoutResultPanel
          orderNumber={checkout.result.orderNumber}
          lineCount={checkout.result.lineCount}
          total={submittedTotalRef.current}
        />
      ) : items.length === 0 ? (
        <CartEmptyState />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            {/* Answers "what just happened". Without it a visitor assumes part of the request went
                through and is afraid to press "Отправить" a second time. */}
            {hasLineErrors && (
              <div
                role="alert"
                className="mb-3.5 flex items-start gap-2.5 rounded-xl bg-danger-soft p-4 ring-1 ring-danger/50"
              >
                <span className="mt-0.5 shrink-0 text-danger">
                  <AlertIcon size={18} />
                </span>
                <div>
                  <p className="font-semibold text-sm text-ink">{t('cart.summary.rejectedNote')}</p>
                  <p className="mt-1 max-w-[64ch] text-[13.5px] leading-snug text-ink-dim">
                    {t('cart.summary.blockedLines')}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {items.map((item) => (
                <CartLineCard
                  key={item.id}
                  item={item}
                  tour={tours[String(item.tourId)]}
                  transfer={transfers[String(item.tourId)]}
                  disabledDates={disabledByTour.get(String(item.tourId)) ?? EMPTY_DATES}
                  window={bookingWindow}
                  largeGroupInvitation={content.largeGroupInvitation || t('booking.largeGroupFallback')}
                  error={checkout.lineErrors.get(item.id) ?? null}
                  line={lineStates.get(item.id) ?? UNRESOLVED_LINE}
                  disabled={checkout.running}
                  onChangeDate={handleChangeDate}
                  onChangeGuests={handleChangeGuests}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          </div>

          {/* Below `lg` the summary is an ordinary block after the list, NOT pinned to the bottom
              of the viewport: that space already belongs to the mobile nav bar. */}
          <div className="lg:sticky lg:top-4">
            <CartSummary
              itemCount={items.length}
              total={total}
              originalTotal={originalTotal}
              hasQuoteOnlyLines={hasQuoteOnlyLines}
              blockedBy={blockedBy}
              running={checkout.running}
              formError={checkout.formError}
              authNotice={checkout.authNotice}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/** One shared empty set — a fresh `new Set()` per row would re-run each `DatePicker`'s memo. */
const EMPTY_DATES: ReadonlySet<string> = new Set()

/** Заглушка для позиции, у которой нет продукта: такая строка рисуется в режиме «недоступна» и
 * до полей с ценой не доходит — состояние ей нужно только чтобы удовлетворить тип. */
const UNRESOLVED_LINE: CartLineState = { format: null, seatsLeft: null, issue: null, vehicle: null }
