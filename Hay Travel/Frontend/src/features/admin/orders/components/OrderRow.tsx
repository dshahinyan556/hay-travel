import { Link } from 'react-router'
import type { OrderInfoModel } from '@/shared/types/booking'
import { formatOrderMoney, ordersCopy, statusClasses, statusLabels } from '../lib/ordersCopy'
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
  return (
    <Link
      to={`/admin/orders/${order.id}`}
      className="block rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold break-words text-neutral-900">{orderHeadline(order)}</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {orderEarliestDate(order) || ordersCopy.dash} · Заказ №{order.number}
          </p>
        </div>
        <span
          className={`w-fit shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClasses[order.status]}`}
        >
          {statusLabels[order.status]}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-neutral-600">
          {order.userFullName.trim() || order.userEmail} · {orderTotalGuests(order)} гостей
        </span>
        <span className="font-semibold tabular-nums text-neutral-900">
          {formatOrderMoney(order.total, order.currency)}
        </span>
      </div>
    </Link>
  )
}
