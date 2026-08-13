import { OrderStatus, type OrderInfoModel } from '@/shared/types/booking'
import { calendarCopy, guestsUnit, ordersUnit } from '../lib/calendarCopy'

export interface DayOrdersListProps {
  /** Already narrowed to one day by the parent (cancelled orders are filtered out upstream, in
   * `useCalendarMonth`, so these match the grid's counters exactly). */
  orders: OrderInfoModel[]
  tourTitle: (tourId: number) => string
}

const statusLabels: Record<OrderStatus, string> = {
  [OrderStatus.PendingConfirmation]: calendarCopy.statusPending,
  [OrderStatus.Confirmed]: calendarCopy.statusConfirmed,
  [OrderStatus.Cancelled]: calendarCopy.statusCancelled,
}

const statusClasses: Record<OrderStatus, string> = {
  [OrderStatus.PendingConfirmation]: 'bg-amber-50 text-amber-700',
  [OrderStatus.Confirmed]: 'bg-emerald-50 text-emerald-700',
  [OrderStatus.Cancelled]: 'bg-neutral-100 text-neutral-500',
}

/**
 * Orders of one day, grouped by tour. Purely presentational — no network, no state.
 *
 * Money (`order.payment`) is NOT rendered here: the server computes `TourPriceSnapshot ×
 * GuestCount` and knows nothing about the public site's 5–6 guest tiered surcharge
 * (`shared/currency/pricing.ts`), so showing its number next to what the customer saw on this
 * screen (grouped by tour/day) would put two different totals side by side with no way to explain
 * the gap. `OrderRow` on the Заказы screen shows it — there it's the only total on the card.
 */
export function DayOrdersList({ orders, tourTitle }: DayOrdersListProps) {
  if (orders.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500">
        {calendarCopy.noOrders}
      </p>
    )
  }

  const byTour = new Map<number, OrderInfoModel[]>()
  for (const order of orders) {
    const bucket = byTour.get(order.tourId)
    if (bucket) bucket.push(order)
    else byTour.set(order.tourId, [order])
  }

  return (
    <div className="flex flex-col gap-4">
      {[...byTour.entries()].map(([tourId, tourOrders]) => {
        const guests = tourOrders.reduce((sum, order) => sum + order.guestCount, 0)
        return (
          <section key={tourId}>
            <h4 className="text-sm font-semibold text-neutral-900">{tourTitle(tourId)}</h4>
            <p className="mt-0.5 text-xs text-neutral-500">
              {ordersUnit(tourOrders.length)} · {guestsUnit(guests)}
            </p>

            <ul className="mt-2 flex flex-col gap-2">
              {tourOrders.map((order) => (
                <li
                  key={order.id}
                  className="rounded-lg border border-neutral-200 px-3 py-2.5 text-sm"
                >
                  {/* Column below `sm`: the name/status pair and the meta line each need a full
                      line at 360px. */}
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                    <span className="font-semibold break-words text-neutral-900">
                      {order.userFullName.trim() || order.userEmail}
                    </span>
                    <span
                      className={`w-fit shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClasses[order.status]}`}
                    >
                      {statusLabels[order.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    {guestsUnit(order.guestCount)} · Заказ №{order.id} ·{' '}
                    {/* The backend stores `Kind=Utc` correctly since 2026-08-11, so the browser
                        converts to local time on its own. */}
                    {new Date(order.createdAtUtc).toLocaleString('ru-RU')}
                  </p>
                  <a
                    href={`mailto:${order.userEmail}`}
                    className="mt-1 inline-block text-xs break-all text-brand-700 hover:underline"
                  >
                    {order.userEmail}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
