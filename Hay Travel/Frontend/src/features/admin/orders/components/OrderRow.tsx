import { Link } from 'react-router'
import { OrderStatusBadge } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import type { OrderInfoModel } from '@/shared/types/booking'
import { formatOrderMoney, ordersCopy, statusBadgeTone } from '../lib/ordersCopy'
import { orderEarliestDate, orderHeadline, orderTotalGuests } from '../lib/ordersModel'

export interface OrderRowProps {
  order: OrderInfoModel
}

/**
 * One row of the Заказы list — deliberately minimal (headline tour + earliest date, client,
 * status, grand total): the full picture (per-line grid, payments, fulfillment) lives one click
 * away on `OrderDetailPage`. The whole card is the link, not a button inside it — a list of orders
 * is a list of navigation targets, nothing here mutates state.
 */
export function OrderRow({ order }: OrderRowProps) {
  const copy = useCopy(ordersCopy)
  const { locale } = useLocale()

  return (
    <Link
      to={`/admin/orders/${order.id}`}
      className="block rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold break-words text-neutral-900">{orderHeadline(order, copy)}</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {orderEarliestDate(order) || copy.dash} · {copy.orderTitle(order.number)}
          </p>
        </div>
        <OrderStatusBadge
          className="w-fit shrink-0"
          label={copy.statusLabels[order.status]}
          tone={statusBadgeTone[order.status]}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-neutral-600">
          {order.userFullName.trim() || order.userEmail} · {copy.guestsUnit(orderTotalGuests(order))}
        </span>
        <span className="font-semibold tabular-nums text-neutral-900">
          {formatOrderMoney(order.total, order.currency, locale)}
        </span>
      </div>
    </Link>
  )
}
