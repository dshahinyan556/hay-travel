import { Link } from 'react-router'
import { OrderStatusBadge, Textarea } from '@/shared/ui'
import { OrderStatus, type OrderInfoModel } from '@/shared/types/booking'
import { ordersCopy, statusBadgeTone, statusLabels } from '../lib/ordersCopy'

export interface OrderHeaderProps {
  /** Already draft-applied (checklist §2) — `rejectReason` here may be an unsaved edit, everything
   * else is always the last-loaded/saved value. This component reads, it never diffs against a
   * "real" order itself. */
  order: OrderInfoModel
  pending: boolean
  /** Writes straight into the page-level draft on every keystroke — no local state, no onBlur
   * diffing: nothing hits the network until the page's Save button is pressed. */
  onRejectReasonChange: (reason: string) => void
}

/**
 * The order's always-visible header — number, client (a plain link to their admin profile, new
 * tab), a READ-ONLY status badge (checklist §4 — status changes ONLY through the Approve/Reject
 * context actions above this header, never edited here) and the reject-reason field, shown only
 * while `status === Rejected`. The toolbar/context-actions/"…" menu live ABOVE this header now
 * (see `OrderDetailPage`), not inside it — this component is just the record's own identity card.
 */
export function OrderHeader({ order, pending, onRejectReasonChange }: OrderHeaderProps) {
  return (
    <header className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5">
      <nav className="text-xs text-neutral-500" aria-label="Хлебные крошки">
        <Link to="/admin/orders" className="transition-colors hover:text-neutral-800">
          {ordersCopy.backToList}
        </Link>
        <span aria-hidden="true"> · </span>
        <span className="font-semibold text-neutral-800">{ordersCopy.orderTitle(order.number)}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-neutral-900">{ordersCopy.orderTitle(order.number)}</h1>
          <Link
            to={`/admin/users/${order.userId}`}
            target="_blank"
            className="font-semibold break-words text-brand-700 hover:underline"
          >
            {order.userFullName.trim() || order.userEmail}
          </Link>
          <p className="mt-0.5 text-sm text-neutral-500">
            {ordersCopy.createdLabel}: {new Date(order.createdAtUtc).toLocaleString('ru-RU')}
            {' · '}
            {ordersCopy.approvedLabel}:{' '}
            {order.approvedAtUtc ? new Date(order.approvedAtUtc).toLocaleString('ru-RU') : ordersCopy.notApprovedYet}
          </p>
        </div>

        <OrderStatusBadge label={statusLabels[order.status]} tone={statusBadgeTone[order.status]} />
      </div>

      {order.status === OrderStatus.Rejected && (
        <label className="text-xs text-neutral-500">
          {ordersCopy.rejectReasonLabel}
          <Textarea
            value={order.rejectReason ?? ''}
            disabled={pending}
            placeholder={ordersCopy.rejectReasonPlaceholder}
            onChange={(e) => onRejectReasonChange(e.target.value)}
            className="mt-1"
            rows={2}
          />
        </label>
      )}
    </header>
  )
}
