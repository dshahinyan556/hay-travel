import { useState } from 'react'
import { Button, DatePicker, Input, Modal } from '@/shared/ui'
import { OrderStatus, type OrderInfoModel } from '@/shared/types/booking'
import { ordersCopy } from '../lib/ordersCopy'

const MIN_GUESTS = 1
const MAX_GUESTS = 99

export interface OrderOverviewTabProps {
  order: OrderInfoModel
  pending: boolean
  onConfirm: () => void
  onCancel: () => void
  onSave: (tourDate: string, guestCount: number) => void
}

/**
 * "Обзор" tab of `OrderDetailPage`: tour/date/guests, created/confirmed timestamps, and — only
 * while `PendingConfirmation` — Confirm/Edit/Cancel. A Confirmed order may still be Cancelled (a
 * customer calling to back out), but never edited: the backend already refuses that
 * (`OrderNotEditable`), this just avoids letting the admin try. Ported from the pre-B12-redesign
 * `OrderRow`, which used to hold this inline in the list — now it lives one click in.
 */
export function OrderOverviewTab({ order, pending, onConfirm, onCancel, onSave }: OrderOverviewTabProps) {
  const [editing, setEditing] = useState(false)
  const [draftDate, setDraftDate] = useState(order.tourDate)
  const [draftGuests, setDraftGuests] = useState(order.guestCount)
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  const isPending = order.status === OrderStatus.PendingConfirmation

  function startEdit() {
    setDraftDate(order.tourDate)
    setDraftGuests(order.guestCount)
    setEditing(true)
  }

  function save() {
    onSave(draftDate, draftGuests)
    setEditing(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-neutral-200 bg-white p-4 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs text-neutral-500">{ordersCopy.editDateLabel}</p>
          <p className="mt-0.5 font-medium text-neutral-900">{order.tourDate}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-500">{ordersCopy.editGuestsLabel}</p>
          <p className="mt-0.5 font-medium text-neutral-900">{order.guestCount}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-500">{ordersCopy.createdLabel}</p>
          <p className="mt-0.5 font-medium text-neutral-900">
            {new Date(order.createdAtUtc).toLocaleString('ru-RU')}
          </p>
        </div>
        <div>
          <p className="text-xs text-neutral-500">{ordersCopy.confirmedLabel}</p>
          <p className="mt-0.5 font-medium text-neutral-900">
            {order.confirmedAtUtc
              ? new Date(order.confirmedAtUtc).toLocaleString('ru-RU')
              : ordersCopy.notConfirmedYet}
          </p>
        </div>
      </div>

      {editing && (
        <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:flex-row sm:items-end">
          <label className="flex-1 text-xs text-neutral-500">
            {ordersCopy.editDateLabel}
            <DatePicker value={draftDate} onChange={setDraftDate} surface="admin" className="mt-1" />
          </label>
          <label className="text-xs text-neutral-500">
            {ordersCopy.editGuestsLabel}
            <Input
              type="number"
              min={MIN_GUESTS}
              max={MAX_GUESTS}
              value={draftGuests}
              onChange={(e) => setDraftGuests(Number(e.target.value))}
              className="mt-1 w-24"
            />
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending || draftDate === '' || draftGuests < MIN_GUESTS}
              onClick={save}
              className="min-h-11"
            >
              {pending ? ordersCopy.saving : ordersCopy.save}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => setEditing(false)}
              className="min-h-11"
            >
              {ordersCopy.cancelEdit}
            </Button>
          </div>
        </div>
      )}

      {!editing && order.status !== OrderStatus.Cancelled && (
        <div className="flex flex-wrap gap-2">
          {isPending && (
            <>
              <Button type="button" size="sm" disabled={pending} onClick={onConfirm} className="min-h-11">
                {ordersCopy.confirm}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={startEdit}
                className="min-h-11"
              >
                {ordersCopy.edit}
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => setConfirmingCancel(true)}
            className="min-h-11"
          >
            {ordersCopy.cancel}
          </Button>
        </div>
      )}

      <Modal
        open={confirmingCancel}
        onClose={() => setConfirmingCancel(false)}
        title={ordersCopy.cancelConfirmTitle}
      >
        <p className="text-sm text-neutral-600">{ordersCopy.cancelConfirmBody}</p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirmingCancel(false)}
            disabled={pending}
            className="min-h-11 w-full sm:w-auto"
          >
            {ordersCopy.cancelConfirmDismiss}
          </Button>
          <Button
            type="button"
            onClick={() => {
              setConfirmingCancel(false)
              onCancel()
            }}
            disabled={pending}
            className="min-h-11 w-full sm:w-auto"
          >
            {ordersCopy.cancelConfirmAction}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
