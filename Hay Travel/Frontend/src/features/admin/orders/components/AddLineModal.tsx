import { useState } from 'react'
import { Button, Checkbox, DatePicker, Field, Input, Modal, Select } from '@/shared/ui'
import type { TourInfoModel } from '@/shared/types/attours'
import { ordersCopy } from '../lib/ordersCopy'
import { tourTitleResolver } from '../lib/ordersModel'

export interface NewLineDraft {
  tourId: number
  tourDate: string
  guestCount: number
  requiresPrepayment: boolean
  prepaymentAmount: number
}

export interface AddLineModalProps {
  open: boolean
  tours: TourInfoModel[]
  pending: boolean
  onClose: () => void
  onSubmit: (draft: NewLineDraft) => void
}

const MIN_GUESTS = 1
const MAX_GUESTS = 99

/** "+ Добавить строку" form (checklist Фаза 9.4) — a `Modal` rather than an inline expanding row:
 * it needs a tour picker, a date, a guest count and an optional prepayment amount, which is more
 * fields than a grid row has room for without pushing every column around while it's open. */
export function AddLineModal({ open, tours, pending, onClose, onSubmit }: AddLineModalProps) {
  const tourTitle = tourTitleResolver(tours)
  const [tourId, setTourId] = useState('')
  const [tourDate, setTourDate] = useState('')
  const [guestCount, setGuestCount] = useState(2)
  const [requiresPrepayment, setRequiresPrepayment] = useState(false)
  const [prepaymentAmount, setPrepaymentAmount] = useState(0)

  function reset() {
    setTourId('')
    setTourDate('')
    setGuestCount(2)
    setRequiresPrepayment(false)
    setPrepaymentAmount(0)
  }

  const canSubmit = tourId !== '' && tourDate !== '' && guestCount >= MIN_GUESTS

  function submit() {
    if (!canSubmit) return
    onSubmit({
      tourId: Number(tourId),
      tourDate,
      guestCount,
      requiresPrepayment,
      prepaymentAmount: requiresPrepayment ? prepaymentAmount : 0,
    })
    reset()
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title={ordersCopy.addLineTitle}>
      <div className="flex flex-col gap-3">
        <Field label={ordersCopy.fieldTour} htmlFor="new-line-tour">
          <Select
            id="new-line-tour"
            surface="admin"
            value={tourId}
            onChange={setTourId}
            options={tours.map((tour) => ({ value: String(tour.id), label: tourTitle(tour.id) }))}
            placeholder={ordersCopy.fieldTourPlaceholder}
            searchable
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={ordersCopy.fieldDate}>
            <DatePicker value={tourDate} onChange={setTourDate} surface="admin" />
          </Field>
          <Field label={ordersCopy.fieldGuests} htmlFor="new-line-guests">
            <Input
              id="new-line-guests"
              type="number"
              min={MIN_GUESTS}
              max={MAX_GUESTS}
              value={guestCount}
              onChange={(e) => setGuestCount(Number(e.target.value))}
            />
          </Field>
        </div>

        <Checkbox
          label={ordersCopy.fieldRequiresPrepayment}
          checked={requiresPrepayment}
          onChange={(e) => setRequiresPrepayment(e.target.checked)}
        />

        {requiresPrepayment && (
          <Field label={ordersCopy.fieldPrepaymentAmount} htmlFor="new-line-prepayment">
            <Input
              id="new-line-prepayment"
              type="number"
              min={0}
              value={prepaymentAmount}
              onChange={(e) => setPrepaymentAmount(Number(e.target.value))}
            />
          </Field>
        )}

        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => { reset(); onClose() }}
            className="min-h-11 w-full sm:w-auto"
          >
            {ordersCopy.addLineCancel}
          </Button>
          <Button
            type="button"
            disabled={pending || !canSubmit}
            onClick={submit}
            className="min-h-11 w-full sm:w-auto"
          >
            {pending ? ordersCopy.saving : ordersCopy.addLineSubmit}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
