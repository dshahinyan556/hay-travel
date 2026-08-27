import { useState } from 'react'
import { Button, Input, Select, Tooltip } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { OrderPaymentType, type OrderInfoModel } from '@/shared/types/booking'
import { formatOrderDateTime, formatOrderMoney, ordersCopy, type OrdersCopy } from '../lib/ordersCopy'

export interface OrderPaymentTabProps {
  order: OrderInfoModel
  pending: boolean
  /** Причина недоступности записи оплаты (`AddPayment` = `Create`, не `Update`), или `null`.
   * @default null */
  createHint?: string | null
  onAddPayment: (lineId: number, type: OrderPaymentType, amount: number) => void
}

/** Both the ledger rows and the "add entry" picker name the two transaction kinds, so the map is
 * built once per render from the resolved copy instead of twice from a module constant. */
const paymentTypeLabels = (copy: OrdersCopy): Record<OrderPaymentType, string> => ({
  [OrderPaymentType.Prepayment]: copy.paymentTypePrepayment,
  [OrderPaymentType.Payment]: copy.paymentTypePayment,
})

function AddPaymentForm({
  pending,
  createHint,
  onAdd,
}: {
  pending: boolean
  createHint: string | null
  onAdd: (type: OrderPaymentType, amount: number) => void
}) {
  const copy = useCopy(ordersCopy)
  const typeLabels = paymentTypeLabels(copy)
  const typeOptions = [
    { value: String(OrderPaymentType.Prepayment), label: typeLabels[OrderPaymentType.Prepayment] },
    { value: String(OrderPaymentType.Payment), label: typeLabels[OrderPaymentType.Payment] },
  ]
  const [open, setOpen] = useState(false)
  const [type, setType] = useState(String(OrderPaymentType.Prepayment))
  const [amount, setAmount] = useState('')

  if (!open) {
    return (
      <Tooltip enabled={createHint !== null} content={createHint} cursor="not-allowed" className="self-start">
        <button
          type="button"
          disabled={pending || createHint !== null}
          onClick={() => setOpen(true)}
          className="min-h-9 self-start rounded-lg px-2.5 py-1 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + {copy.addPayment}
        </button>
      </Tooltip>
    )
  }

  const numericAmount = Number(amount)
  const canSubmit = amount !== '' && Number.isFinite(numericAmount) && numericAmount > 0

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
      <label className="text-xs text-neutral-500">
        {copy.paymentTypeLabel}
        <Select surface="admin" value={type} onChange={setType} options={typeOptions} className="mt-1 w-36" />
      </label>
      <label className="text-xs text-neutral-500">
        {copy.paymentAmountLabel}
        <Input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-28"
        />
      </label>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending || !canSubmit}
          onClick={() => {
            onAdd(Number(type) as OrderPaymentType, numericAmount)
            setOpen(false)
            setAmount('')
          }}
          className="min-h-11"
        >
          {copy.paymentSubmit}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => setOpen(false)}
          className="min-h-11"
        >
          {copy.paymentCancel}
        </Button>
      </div>
    </div>
  )
}

/**
 * "Оплата" tab (checklist Фаза 10) — `OrderPayment` is now a LEDGER of transactions per line
 * (ADR 019), not a single снапшот total: each line gets its own list of entries plus a form to add
 * one manually (there is no payment gateway; the admin records the fact of payment themselves).
 */
export function OrderPaymentTab({ order, pending, createHint = null, onAddPayment }: OrderPaymentTabProps) {
  const copy = useCopy(ordersCopy)
  const { locale } = useLocale()
  const typeLabels = paymentTypeLabels(copy)

  return (
    <div className="flex flex-col gap-4">
      {order.lines.map((line) => (
        <div key={line.id} className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-neutral-900">{line.tourTitle ?? copy.tourFallback(line.tourId)}</p>
              <p className="text-xs text-neutral-500">{line.tourDate}</p>
            </div>
            <p className="text-xs text-neutral-500">
              {line.requiresPrepayment
                ? copy.linePrepaymentRequired(formatOrderMoney(line.prepaymentAmount, order.currency, locale))
                : copy.linePrepaymentNotRequired}
            </p>
          </div>

          {line.payments.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-neutral-200 px-3 py-4 text-center text-sm text-neutral-500">
              {copy.paymentsEmpty}
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-1.5">
              {line.payments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-sm"
                >
                  <span className="text-neutral-600">
                    {typeLabels[payment.type]} · {copy.paymentNumber(payment.number)} ·{' '}
                    {formatOrderDateTime(payment.createdAtUtc, locale)}
                  </span>
                  <span className="font-semibold tabular-nums text-neutral-900">
                    {formatOrderMoney(payment.amount, order.currency, locale)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3">
            <AddPaymentForm
              pending={pending}
              createHint={createHint}
              onAdd={(type, amount) => onAddPayment(line.id, type, amount)}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
