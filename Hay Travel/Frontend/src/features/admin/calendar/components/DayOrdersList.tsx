import { OrderStatusBadge, type OrderStatusBadgeTone } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { OrderStatus } from '@/shared/types/booking'
import { calendarCopy } from '../lib/calendarCopy'
import type { CalendarOrderLine } from '../lib/calendarModel'

export interface DayOrdersListProps {
  /** Already narrowed to one day by the parent, and already flattened order→line with Rejected
   * orders dropped upstream in `useCalendarMonth` (see `flattenOrderLines`) — matches the grid's
   * counters exactly (`OrderCalendarInfo`'s own occupancy rule, checklist-orders-redesign.txt
   * Фаза 1.8). */
  orders: CalendarOrderLine[]
  tourTitle: (tourId: number) => string
}

/** Same tone mapping as `orders/lib/ordersCopy.ts`'s `statusBadgeTone` — kept as a local literal
 * rather than a cross-feature import (calendar doesn't otherwise reach into the orders feature). */
const statusTones: Record<OrderStatus, OrderStatusBadgeTone> = {
  [OrderStatus.Open]: 'neutral',
  [OrderStatus.Hold]: 'muted',
  [OrderStatus.Approved]: 'strong',
  [OrderStatus.Rejected]: 'muted',
  [OrderStatus.ReadyForAssignment]: 'neutral',
  [OrderStatus.PendingPayment]: 'neutral',
  [OrderStatus.Completed]: 'strong',
}

/**
 * Order lines of one day, grouped by tour. Purely presentational — no network, no state.
 *
 * Money is NOT rendered here: the server computes each line's total and knows nothing about the
 * public site's 5–6 guest tiered surcharge (`shared/currency/pricing.ts`), so showing its number
 * next to what the customer saw on this screen (grouped by tour/day) would put two different
 * totals side by side with no way to explain the gap. `OrderRow` on the Заказы screen shows it —
 * there it's the only total on the card.
 */
export function DayOrdersList({ orders, tourTitle }: DayOrdersListProps) {
  const copy = useCopy(calendarCopy)

  if (orders.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500">
        {copy.noOrders}
      </p>
    )
  }

  const byTour = new Map<number, CalendarOrderLine[]>()
  for (const line of orders) {
    const bucket = byTour.get(line.tourId)
    if (bucket) bucket.push(line)
    else byTour.set(line.tourId, [line])
  }

  return (
    <div className="flex flex-col gap-4">
      {[...byTour.entries()].map(([tourId, tourLines]) => {
        const guests = tourLines.reduce((sum, line) => sum + line.guestCount, 0)
        return (
          <section key={tourId}>
            <h4 className="text-sm font-semibold text-neutral-900">{tourTitle(tourId)}</h4>
            <p className="mt-0.5 text-xs text-neutral-500">
              {copy.ordersUnit(tourLines.length)} · {copy.guestsUnit(guests)}
            </p>

            <ul className="mt-2 flex flex-col gap-2">
              {tourLines.map((line, index) => (
                <li
                  key={`${line.orderId}-${index}`}
                  className="rounded-lg border border-neutral-200 px-3 py-2.5 text-sm"
                >
                  {/* Column below `sm`: the name/status pair and the meta line each need a full
                      line at 360px. */}
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                    <span className="font-semibold break-words text-neutral-900">
                      {line.userFullName.trim() || line.userEmail}
                    </span>
                    <OrderStatusBadge
                      className="w-fit shrink-0"
                      label={copy.statusLabels[line.status]}
                      tone={statusTones[line.status]}
                    />
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    {copy.guestsUnit(line.guestCount)} · {copy.orderNumber(line.orderNumber)} ·{' '}
                    {/* The backend stores `Kind=Utc` correctly since 2026-08-11, so the browser
                        converts to local time on its own. */}
                    {copy.formatDateTime(line.createdAtUtc)}
                  </p>
                  <a
                    href={`mailto:${line.userEmail}`}
                    className="mt-1 inline-block text-xs break-all text-neutral-700 hover:underline"
                  >
                    {line.userEmail}
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
