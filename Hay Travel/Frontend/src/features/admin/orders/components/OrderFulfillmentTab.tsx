import { Button, Input, Textarea } from '@/shared/ui'
import type { OrderInfoModel, OrderLineInfoModel } from '@/shared/types/booking'
import { ordersCopy } from '../lib/ordersCopy'

export interface OrderFulfillmentTabProps {
  /** Already draft-applied (checklist §2) — `pickupDetails`/`navigatorLink` here may be unsaved
   * edits, the page's global Save/Cancel (not this tab) is what commits/discards them. */
  order: OrderInfoModel
  pending: boolean
  onChangePickup: (line: OrderLineInfoModel, pickupDetails: string) => void
  onChangeNavigator: (line: OrderLineInfoModel, navigatorLink: string) => void
  onAssignAndSend: (line: OrderLineInfoModel) => void
}

function LineFulfillmentCard({
  line,
  pending,
  onChangePickup,
  onChangeNavigator,
  onAssignAndSend,
}: {
  line: OrderLineInfoModel
  pending: boolean
  onChangePickup: (pickupDetails: string) => void
  onChangeNavigator: (navigatorLink: string) => void
  onAssignAndSend: () => void
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-neutral-900">{line.tourTitle ?? `Тур #${line.tourId}`}</p>
          <p className="text-xs text-neutral-500">{line.tourDate}</p>
        </div>
        <p className="text-xs text-neutral-500">
          {ordersCopy.colEmployee}: {line.employeeFullName?.trim() || ordersCopy.employeeUnassigned}
        </p>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <label className="text-xs text-neutral-500">
          {ordersCopy.fulfillmentPickupLabel}
          <Textarea
            value={line.pickupDetails ?? ''}
            disabled={pending}
            placeholder={ordersCopy.fulfillmentPickupPlaceholder}
            onChange={(e) => onChangePickup(e.target.value)}
            className="mt-1"
            rows={2}
          />
        </label>
        <label className="text-xs text-neutral-500">
          {ordersCopy.fulfillmentNavigatorLabel}
          <Input
            value={line.navigatorLink ?? ''}
            disabled={pending}
            placeholder={ordersCopy.fulfillmentNavigatorPlaceholder}
            onChange={(e) => onChangeNavigator(e.target.value)}
            className="mt-1"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={pending || line.employeeId === null}
            title={line.employeeId === null ? ordersCopy.fulfillmentAssignAndSendHint : undefined}
            onClick={onAssignAndSend}
            className="min-h-11"
          >
            {ordersCopy.fulfillmentAssignAndSend}
          </Button>
        </div>
        {line.employeeId === null && (
          <p className="text-xs text-neutral-500">{ordersCopy.fulfillmentAssignAndSendHint}</p>
        )}
      </div>
    </div>
  )
}

/**
 * "Детали для выполнения" tab (renamed from the old "Клиент" tab — the client's own info moved
 * into the header as a plain link, see `OrderHeader`). Pickup/navigator are now draft fields
 * (checklist §2, no more per-line Save button here — the page's `AdminToolbar` Save/Cancel covers
 * them), plus a re-send of the assignment email once they're filled in (the SAME `assignEmployee`
 * endpoint the overview grid's `Select` already uses — this button targets the line's ALREADY
 * assigned employee, useful after updating pickup/navigator post-assignment; it is NOT a draft
 * field, it fires immediately like every other action-with-side-effects on this page).
 */
export function OrderFulfillmentTab({
  order,
  pending,
  onChangePickup,
  onChangeNavigator,
  onAssignAndSend,
}: OrderFulfillmentTabProps) {
  return (
    <div className="flex flex-col gap-4">
      {order.lines.map((line) => (
        <LineFulfillmentCard
          key={line.id}
          line={line}
          pending={pending}
          onChangePickup={(pickup) => onChangePickup(line, pickup)}
          onChangeNavigator={(navigator) => onChangeNavigator(line, navigator)}
          onAssignAndSend={() => onAssignAndSend(line)}
        />
      ))}
    </div>
  )
}
