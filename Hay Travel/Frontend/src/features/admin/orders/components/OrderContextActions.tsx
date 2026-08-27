import { AdminActionButton, Tooltip } from '@/shared/ui'
import { CheckIcon, CloseIcon, RefreshIcon } from '@/shared/ui/icons'
import { OrderStatus, type OrderInfoModel } from '@/shared/types/booking'
import { useCopy } from '@/shared/i18n/defineCopy'
import { ordersCopy } from '../lib/ordersCopy'

export type OrderContextActionKey = 'approve' | 'reject' | 'reopen' | 'sendToClient' | 'sendToEmployees'

export interface OrderContextActionsProps {
  order: OrderInfoModel
  /** Any request in flight anywhere on the page — every button disables together, same discipline
   * `AdminToolbar`'s buttons already follow (checklist §8: one action at a time). */
  pending: boolean
  /** Which action's request is in flight right now, if any — only that button shows its pending
   * label/spinner, the rest just go `disabled`. */
  busyAction: OrderContextActionKey | null
  /** Причина недоступности смены статуса (`SetStatus` = `Update`), или `null`. Одобрить/Отклонить/
   * Возобновить — один и тот же эндпоинт, поэтому одно значение на все три.
   * @default null */
  updateHint?: string | null
  onApprove: () => void
  onReject: () => void
  onReopen: () => void
}

/**
 * Contextual action row next to `AdminToolbar` — the two decision buttons (checklist §5).
 * Одобрить/Отклонить call `SetStatus` as-is and hide once the order has already been decided (no
 * point re-deciding). Назначить/Отправить-клиенту/Отправить-исполнителям used to live here too,
 * but moved into the "…" `AdminActionsMenu` next to `AdminToolbar` — declutters this row (it was
 * stacking into 3+ separate lines on mobile) and matches the checklist §6 grouped-menu intent that
 * originally had nothing left to populate it. Their handlers/state now live in `OrderDetailPage`.
 * Frozen (Rejected/Completed, checklist-add-order-clients.txt Задача A) is STRONGER than
 * "decided": Approved is decided but stays fully editable, while Rejected/Completed lock
 * everything down to a single "Возобновить" button — that check short-circuits before
 * Approve/Reject visibility is even considered.
 */
export function OrderContextActions({
  order,
  pending,
  busyAction,
  updateHint = null,
  onApprove,
  onReject,
  onReopen,
}: OrderContextActionsProps) {
  const copy = useCopy(ordersCopy)
  const blocked = updateHint !== null
  const frozen = order.status === OrderStatus.Rejected || order.status === OrderStatus.Completed
  if (frozen) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Tooltip enabled={blocked} content={updateHint} cursor="not-allowed">
          <AdminActionButton
            label={copy.actionReopen}
            pendingLabel={copy.actionReopenPending}
            icon={<RefreshIcon size={16} />}
            variant="primary"
            onClick={onReopen}
            disabled={pending || blocked}
            pending={busyAction === 'reopen'}
          />
        </Tooltip>
      </div>
    )
  }

  const decided = order.status === OrderStatus.Approved || order.status === OrderStatus.Rejected
  if (decided) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tooltip enabled={blocked} content={updateHint} cursor="not-allowed">
        <AdminActionButton
          label={copy.actionApprove}
          pendingLabel={copy.actionApprovePending}
          icon={<CheckIcon size={16} />}
          variant="primary"
          onClick={onApprove}
          disabled={pending || blocked}
          pending={busyAction === 'approve'}
        />
      </Tooltip>
      <Tooltip enabled={blocked} content={updateHint} cursor="not-allowed">
        <AdminActionButton
          label={copy.actionReject}
          pendingLabel={copy.actionRejectPending}
          icon={<CloseIcon size={16} />}
          variant="secondary"
          onClick={onReject}
          disabled={pending || blocked}
          pending={busyAction === 'reject'}
        />
      </Tooltip>
    </div>
  )
}
