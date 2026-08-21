import { AdminActionButton } from '@/shared/ui'
import { CheckIcon, CloseIcon, GuideIcon, MailIcon } from '@/shared/ui/icons'
import { OrderStatus, type OrderInfoModel } from '@/shared/types/booking'
import { ordersCopy } from '../lib/ordersCopy'

export type OrderContextActionKey = 'approve' | 'reject' | 'sendToClient' | 'sendToEmployees'

export interface OrderContextActionsProps {
  order: OrderInfoModel
  /** Any request in flight anywhere on the page — every button disables together, same discipline
   * `AdminToolbar`'s buttons already follow (checklist §8: one action at a time). */
  pending: boolean
  /** Which action's request is in flight right now, if any — only that button shows its pending
   * label/spinner, the rest just go `disabled`. */
  busyAction: OrderContextActionKey | null
  onApprove: () => void
  onReject: () => void
  onAssign: () => void
  onSendToClient: () => void
  onSendToEmployees: () => void
}

/**
 * Contextual action row next to `AdminToolbar` (checklist §5) — thin UI wrappers over EXISTING
 * endpoints, no new status values or guarded transitions: Одобрить/Отклонить call `SetStatus`
 * as-is, Назначить opens the (still one-employee-per-line/order) assign popup, and the two "send"
 * actions reuse `SendToClient`/`AssignEmployee`. Approve/Reject hide once the order has already
 * been decided (no point re-deciding); Assign and both "send" actions stay available at every
 * status, matching the original "always active" framing for the email/notify actions.
 */
export function OrderContextActions({
  order,
  pending,
  busyAction,
  onApprove,
  onReject,
  onAssign,
  onSendToClient,
  onSendToEmployees,
}: OrderContextActionsProps) {
  const decided = order.status === OrderStatus.Approved || order.status === OrderStatus.Rejected
  const hasAssignedEmployee = order.lines.some((line) => line.employeeId !== null)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!decided && (
        <>
          <AdminActionButton
            label={ordersCopy.actionApprove}
            pendingLabel={ordersCopy.actionApprovePending}
            icon={<CheckIcon size={16} />}
            variant="primary"
            onClick={onApprove}
            disabled={pending}
            pending={busyAction === 'approve'}
          />
          <AdminActionButton
            label={ordersCopy.actionReject}
            pendingLabel={ordersCopy.actionRejectPending}
            icon={<CloseIcon size={16} />}
            variant="secondary"
            onClick={onReject}
            disabled={pending}
            pending={busyAction === 'reject'}
          />
        </>
      )}
      <AdminActionButton
        label={ordersCopy.actionAssign}
        icon={<GuideIcon size={16} />}
        variant="secondary"
        onClick={onAssign}
        disabled={pending}
      />
      <AdminActionButton
        label={ordersCopy.actionSendToClientLabel}
        pendingLabel={ordersCopy.actionSendToClientPending}
        icon={<MailIcon size={16} />}
        variant="ghost"
        onClick={onSendToClient}
        disabled={pending}
        pending={busyAction === 'sendToClient'}
      />
      <AdminActionButton
        label={ordersCopy.actionSendToEmployees}
        pendingLabel={ordersCopy.actionSendToEmployeesPending}
        icon={<MailIcon size={16} />}
        variant="ghost"
        onClick={onSendToEmployees}
        disabled={pending || !hasAssignedEmployee}
        pending={busyAction === 'sendToEmployees'}
        title={hasAssignedEmployee ? undefined : ordersCopy.actionSendToEmployeesHint}
      />
    </div>
  )
}
