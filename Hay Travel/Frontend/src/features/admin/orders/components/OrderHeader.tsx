import { Link } from 'react-router'
import { OrderStatusBadge, Textarea } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { OrderStatus, type OrderInfoModel } from '@/shared/types/booking'
import { formatOrderDateTime, ordersCopy, statusBadgeTone } from '../lib/ordersCopy'

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
  const copy = useCopy(ordersCopy)
  const { locale } = useLocale()

  return (
    <header className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5">
      <nav className="text-xs text-neutral-500" aria-label={copy.breadcrumbsLabel}>
        <Link to="/admin/orders" className="transition-colors hover:text-neutral-800">
          {copy.backToList}
        </Link>
        <span aria-hidden="true"> · </span>
        <span className="font-semibold text-neutral-800">{copy.orderTitle(order.number)}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-neutral-900">{copy.orderTitle(order.number)}</h1>
          <Link
            to={`/admin/users/${order.userId}`}
            target="_blank"
            className="font-semibold break-words text-neutral-900 hover:underline"
          >
            {order.userFullName.trim() || order.userEmail}
          </Link>
          <p className="mt-0.5 text-sm text-neutral-500">
            {copy.createdLabel}: {formatOrderDateTime(order.createdAtUtc, locale)}
            {' · '}
            {copy.approvedLabel}:{' '}
            {order.approvedAtUtc ? formatOrderDateTime(order.approvedAtUtc, locale) : copy.notApprovedYet}
          </p>
        </div>

        <OrderStatusBadge label={copy.statusLabels[order.status]} tone={statusBadgeTone[order.status]} />
      </div>

      {/* Связь с клиентом. Стоит рядом с его именем, а не во вкладке ниже: это первое, что
          нужно менеджеру, открывшему заказ, — и ровно та задача, ради которой контакты вообще
          появились (клиент оформил заказ с российским номером, а в Армении купил местный).
          Основной идёт первым — порядок задаёт сервер, здесь не сортируем.
          У заказов, созданных до 2026-08-29, контактов нет: блока просто не будет, вместо него
          остаётся почта аккаунта над ним. */}
      {order.contacts.length > 0 && (
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-neutral-200 pt-3">
          {order.contacts.map((contact) => (
            <div key={contact.id} className="text-sm">
              <span className="font-semibold text-neutral-900">
                {[contact.firstName, contact.lastName].filter(Boolean).join(' ')}
              </span>
              {contact.isPrimary && (
                <span className="ml-1.5 rounded-full border border-neutral-300 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-neutral-600 uppercase">
                  {copy.contactPrimary}
                </span>
              )}
              <span className="ml-2 text-neutral-500">{copy.contactMethods[contact.type]}:</span>{' '}
              {/* `select-all`: менеджер копирует номер целиком, а не выделяет его по символу. */}
              <span className="tabular-nums select-all text-neutral-800">{contact.value}</span>
            </div>
          ))}
        </div>
      )}

      {order.status === OrderStatus.Rejected && (
        <label className="text-xs text-neutral-500">
          {copy.rejectReasonLabel}
          <Textarea
            value={order.rejectReason ?? ''}
            disabled={pending}
            placeholder={copy.rejectReasonPlaceholder}
            onChange={(e) => onRejectReasonChange(e.target.value)}
            className="mt-1"
            rows={2}
          />
        </label>
      )}
    </header>
  )
}
