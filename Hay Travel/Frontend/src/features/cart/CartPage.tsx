import { useEffect, useMemo, useRef } from 'react'
import { useLoaderData, useRevalidator } from 'react-router'
import { getClosedDates } from '@/shared/api/booking'
import { getTourInfo } from '@/shared/api/tours'
import { getContentText, type ContentText } from '@/shared/api/siteSettings'
import { getBookingWindow, type BookingWindow } from '@/shared/booking'
import { getCartState, removeCartItem, updateCartItem, useCart } from '@/shared/cart'
import { useAuth } from '@/shared/auth'
import type { TourDetail } from '@/shared/types/tour'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { AlertIcon } from '@/shared/ui/icons'
import { CartEmptyState } from './components/CartEmptyState'
import { CartLineCard } from './components/CartLineCard'
import { CartSummary } from './components/CartSummary'
import { CheckoutResultPanel } from './components/CheckoutResultPanel'
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
  /** Ключ — String(tourId). Закрытые дни в пределах окна бронирования; [] при сбое запроса. */
  closedDates: Record<string, readonly string[]>
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
  const tourIds = [...new Set(items.map((item) => item.tourId))]
  const window = getBookingWindow()

  const [content, resolved] = await Promise.all([
    // Fetched even for an empty cart: one cheap request buys the page a single data contract with
    // no nullable branch. It never rejects, by its own contract.
    getContentText(),
    Promise.all(
      tourIds.map(async (tourId) => {
        const [tour, closed] = await Promise.all([
          // `undefined` (404 — hidden or deleted) must NOT take the page down: that position
          // simply renders as "unavailable". Same contract as `tourDetailLoader`.
          getTourInfo(String(tourId)),
          // Availability likewise never takes a page down — losing the list only means the server
          // gets to reject the day on submit instead.
          getClosedDates(tourId, window.fromISO, window.toISO).catch(() => [] as string[]),
        ])
        return { tourId, tour, closed }
      }),
    ),
  ])

  const tours: Record<string, TourDetail> = {}
  const closedDates: Record<string, readonly string[]> = {}
  for (const entry of resolved) {
    if (entry.tour) tours[String(entry.tourId)] = entry.tour
    closedDates[String(entry.tourId)] = entry.closed
  }

  return { tours, closedDates, content, window }
}

export function CartPage() {
  const { tours, closedDates, content, window: bookingWindow } = useLoaderData() as CartLoaderData
  const { items } = useCart()
  const { status: authStatus } = useAuth()
  const { t } = useLocale()
  const { revalidate } = useRevalidator()

  const checkout = useCheckout()
  const { total, originalTotal, hasQuoteOnlyLines } = useCartTotal(items, tours)

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
    const unknown = items.filter(
      (item) => !(String(item.tourId) in tours) && !askedRef.current.has(item.tourId),
    )
    if (unknown.length === 0) return
    for (const item of unknown) askedRef.current.add(item.tourId)
    void revalidate()
  }, [items, tours, revalidate])

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

  const hasUnavailableTour = items.some((item) => !(String(item.tourId) in tours))
  // Read off the ITEMS, not off the error map's size: editing a date changes a position's id, so a
  // stale key could otherwise keep the button disabled with nothing visibly marked.
  const hasLineErrors = items.some((item) => checkout.lineErrors.has(item.id))
  const sessionUnknown = authStatus !== 'authenticated' && authStatus !== 'anonymous'

  const blockedBy = hasUnavailableTour
    ? 'unavailableTour'
    : hasLineErrors
      ? 'lineErrors'
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
                  disabledDates={disabledByTour.get(String(item.tourId)) ?? EMPTY_DATES}
                  window={bookingWindow}
                  largeGroupInvitation={content.largeGroupInvitation || t('booking.largeGroupFallback')}
                  error={checkout.lineErrors.get(item.id) ?? null}
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
