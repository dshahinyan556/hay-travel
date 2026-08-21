import { useState } from 'react'
import { Link } from 'react-router'
import { Checkbox, Input, Select } from '@/shared/ui'
import type { UserInfoModel } from '@/shared/auth'
import type { OrderInfoModel, OrderLineInfoModel } from '@/shared/types/booking'
import { formatOrderMoney, ordersCopy } from '../lib/ordersCopy'

export interface OrderLinesGridProps {
  order: OrderInfoModel
  employees: UserInfoModel[]
  /** Disables every mutation while a request from ANY row is in flight — same one-at-a-time
   * discipline `OrderDetailPage`'s `run` helper enforces for the rest of the page. */
  pending: boolean
  onAssignEmployee: (lineId: number, employeeId: number) => void
  onToggleRequiresPrepayment: (line: OrderLineInfoModel, requiresPrepayment: boolean) => void
  onSavePrepaymentAmount: (line: OrderLineInfoModel, amount: number) => void
  onAddLine: () => void
  onRemoveLines: (lineIds: number[]) => void
}

const employeeOptions = (employees: UserInfoModel[]) => [
  { value: '', label: ordersCopy.employeeUnassigned },
  ...employees.map((employee) => ({
    value: String(employee.id),
    label: `${employee.firstName} ${employee.lastName ?? ''}`.trim() || employee.email,
  })),
]

/** One line's prepayment amount — fully controlled off `line.prepaymentAmount`, which the page
 * already resolves through the draft (checklist §2): nothing here saves on its own, `onChange`
 * just writes the next draft value, and the page's Save button is what actually persists it. */
function PrepaymentAmountInput({
  line,
  disabled,
  onChange,
}: {
  line: OrderLineInfoModel
  disabled: boolean
  onChange: (amount: number) => void
}) {
  return (
    <Input
      type="number"
      min={0}
      value={String(line.prepaymentAmount)}
      disabled={disabled}
      onChange={(e) => {
        const value = Number(e.target.value)
        if (Number.isFinite(value) && value >= 0) onChange(value)
      }}
      className="w-28"
    />
  )
}

/**
 * The order's line grid — its own tour/date/guests/employee/prepayment/money per row
 * (checklist-orders-redesign.txt Фаза 9.3/9.4). A real `<table>` in a horizontally-scrolling
 * wrapper, same convention `ProductsTable` already established for admin grids this wide — a card
 * layout would either truncate columns or force the same horizontal scroll one level deeper.
 */
export function OrderLinesGrid({
  order,
  employees,
  pending,
  onAssignEmployee,
  onToggleRequiresPrepayment,
  onSavePrepaymentAmount,
  onAddLine,
  onRemoveLines,
}: OrderLinesGridProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set())

  function toggleSelected(lineId: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(lineId)) next.delete(lineId)
      else next.add(lineId)
      return next
    })
  }

  function removeSelected() {
    onRemoveLines([...selected])
    setSelected(new Set())
  }

  const options = employeeOptions(employees)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-neutral-900">{ordersCopy.linesTitle}</h3>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={removeSelected}
              className="min-h-9 rounded-lg px-3 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={ordersCopy.removeLine}
            >
              × {ordersCopy.removeLineSelected(selected.size)}
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={onAddLine}
            className="min-h-9 rounded-lg bg-brand-700 px-3 text-sm font-medium text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={ordersCopy.addLine}
          >
            + {ordersCopy.addLine}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-50 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              <th className="w-10 px-3 py-2.5" />
              <th className="px-3 py-2.5">{ordersCopy.colProduct}</th>
              <th className="w-28 px-3 py-2.5">{ordersCopy.colDate}</th>
              <th className="w-20 px-3 py-2.5 text-right">{ordersCopy.colGuests}</th>
              <th className="w-44 px-3 py-2.5">{ordersCopy.colEmployee}</th>
              <th className="w-56 px-3 py-2.5">{ordersCopy.colPrepayment}</th>
              <th className="w-28 px-3 py-2.5 text-right">{ordersCopy.colPrice}</th>
              <th className="w-20 px-3 py-2.5 text-right">{ordersCopy.colDiscount}</th>
              <th className="w-28 px-3 py-2.5 text-right">{ordersCopy.colTotal}</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.id} className="border-t border-neutral-100">
                <td className="px-3 py-2.5">
                  <Checkbox
                    label=""
                    aria-label={`Выбрать строку: ${line.tourTitle ?? line.tourId}`}
                    checked={selected.has(line.id)}
                    onChange={() => toggleSelected(line.id)}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    to={`/admin/tours/${line.tourId}/edit`}
                    target="_blank"
                    className="text-brand-700 hover:underline"
                  >
                    {line.tourTitle ?? `Тур #${line.tourId}`}
                  </Link>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-neutral-700">{line.tourDate}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-neutral-700">{line.guestCount}</td>
                <td className="px-3 py-2.5">
                  <Select
                    surface="admin"
                    value={line.employeeId === null ? '' : String(line.employeeId)}
                    onChange={(value) => value !== '' && onAssignEmployee(line.id, Number(value))}
                    options={options}
                    disabled={pending}
                    aria-label={`${ordersCopy.colEmployee}: ${line.tourTitle ?? line.tourId}`}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      label=""
                      aria-label={ordersCopy.colPrepayment}
                      checked={line.requiresPrepayment}
                      disabled={pending}
                      onChange={(e) => onToggleRequiresPrepayment(line, e.target.checked)}
                    />
                    {line.requiresPrepayment && (
                      <PrepaymentAmountInput
                        line={line}
                        disabled={pending}
                        onChange={(amount) => onSavePrepaymentAmount(line, amount)}
                      />
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-neutral-700">
                  {formatOrderMoney(line.priceSnapshot, order.currency)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-rose-700">
                  {line.discountPercent ? ordersCopy.discountBadge(line.discountPercent) : ordersCopy.dash}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-neutral-900">
                  {formatOrderMoney(line.lineTotal, order.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
