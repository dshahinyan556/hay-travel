import { Link } from 'react-router'
import { resolveTier } from '@/shared/currency/pricing'
import { OrderStatus, type OrderInfoModel } from '@/shared/types/booking'
import { formatOrderMoney, ordersCopy } from '../lib/ordersCopy'

const statusClasses: Record<OrderStatus, string> = {
  [OrderStatus.PendingConfirmation]: 'bg-amber-50 text-amber-700',
  [OrderStatus.Confirmed]: 'bg-emerald-50 text-emerald-700',
  [OrderStatus.Cancelled]: 'bg-neutral-100 text-neutral-500',
}

const statusLabels: Record<OrderStatus, string> = {
  [OrderStatus.PendingConfirmation]: ordersCopy.statusPending,
  [OrderStatus.Confirmed]: ordersCopy.statusConfirmed,
  [OrderStatus.Cancelled]: ordersCopy.statusCancelled,
}

export interface OrderRowProps {
  order: OrderInfoModel
}

/**
 * One row of the Заказы list — deliberately minimal (tour+date, client, status, total): the full
 * picture (payment breakdown, timestamps, client's other orders, confirm/edit/cancel) lives one
 * click away on `OrderDetailPage` (B12 redesign, 2026-08-13). The whole card is the link, not a
 * button inside it — a list of orders is a list of navigation targets, nothing here mutates state.
 */
export function OrderRow({ order }: OrderRowProps) {
  const isQuoteNeeded = resolveTier(order.guestCount) === 'hidden'

  return (
    <Link
      to={`/admin/orders/${order.id}`}
      className="block rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold break-words text-neutral-900">{order.tourTitle}</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {order.tourDate} · Заказ №{order.id}
          </p>
        </div>
        <span
          className={`w-fit shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClasses[order.status]}`}
        >
          {statusLabels[order.status]}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-neutral-600">{order.userFullName.trim() || order.userEmail}</span>
        <span className="font-semibold tabular-nums text-neutral-900">
          {isQuoteNeeded
            ? ordersCopy.quoteNeeded
            : formatOrderMoney(order.payment.totalAmount, order.payment.currency)}
        </span>
      </div>
    </Link>
  )
}
