import { useState } from 'react'
import { Link } from 'react-router'
import { AdminActionButton, Checkbox, Input, Tooltip } from '@/shared/ui'
import type {
  OrderInfoModel,
  OrderLineEmployeeInfoModel,
  OrderLineInfoModel,
} from '@/shared/types/booking'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { adminEnumsCopy } from '@/features/admin/lib/adminEnumsCopy'
import { employeeRoleLabel, formatOrderMoney, ordersCopy } from '../lib/ordersCopy'
import {
  NO_ORDER_PERMISSION_HINTS,
  type OrderPermissionHints,
} from '../lib/orderPermissionHints'
import type { UnassignTarget } from '../OrderDetailPage'

export interface OrderLinesGridProps {
  order: OrderInfoModel
  /** Disables every mutation while a request from ANY row is in flight — same one-at-a-time
   * discipline `OrderDetailPage`'s `run` helper enforces for the rest of the page. */
  pending: boolean
  /** Reason-or-`null` per action kind (`orderPermissionHints.ts`). Independent of `pending`: a
   * control blocked BOTH ways stays disabled and explains the permission, because that is the
   * reason that will not go away on its own.
   * @default NO_ORDER_PERMISSION_HINTS */
  hints?: OrderPermissionHints
  /** Открыть попап назначения на ЭТУ строку. */
  onRequestAssign: (lineId: number) => void
  /** Reports intent only — the page owns the confirmation modal, same split as `RoleSelect`
   * reporting a pick while `UsersPage` owns the promote-to-admin confirm. */
  onRequestUnassign: (target: UnassignTarget) => void
  onToggleRequiresPrepayment: (line: OrderLineInfoModel, requiresPrepayment: boolean) => void
  onSavePrepaymentAmount: (line: OrderLineInfoModel, amount: number) => void
  onAddLine: () => void
  onRemoveLines: (lineIds: number[]) => void
}

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
 * Колонка «Исполнители» — READ-ONLY отображение набора (редизайн 2026-08-23). Инлайн-редактор из
 * двух `Select`ов удалён: `Select` не выражает множество, а «сменить выбор» перестало быть
 * осмысленной операцией — снятие теперь адресное, по конкретному человеку.
 *
 * Все мутации уходят наверх: «×» просит подтверждение снятия у страницы, «+ Назначить» открывает
 * общий попап мультивыбора с `lineId` этой строки. Так логика назначения перестала жить в двух
 * местах с разными правилами про роль по умолчанию.
 */
function LineEmployeesCell({
  line,
  pending,
  updateHint,
  onRequestAssign,
  onRequestUnassign,
}: {
  line: OrderLineInfoModel
  pending: boolean
  /** `AssignEmployee`/`UnassignEmployee` — оба `Update` на бэке, поэтому «×» и «+ Назначить»
   * гейтятся одним и тем же значением. */
  updateHint: string | null
  onRequestAssign: () => void
  onRequestUnassign: (employee: OrderLineEmployeeInfoModel) => void
}) {
  const copy = useCopy(ordersCopy)
  const roleLabels = useCopy(adminEnumsCopy).employeeJobRole

  return (
    <div className="flex flex-col items-start gap-1.5">
      {line.employees.length === 0 ? (
        <span className="text-xs text-neutral-500">{copy.employeeUnassigned}</span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {line.employees.map((employee) => {
            const name = employee.employeeFullName?.trim() || copy.dash
            return (
              <span
                key={employee.id}
                className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-800"
              >
                <span>
                  {name} <span className="text-neutral-500">({employeeRoleLabel(roleLabels, employee.employeeRole)})</span>
                </span>
                <Tooltip enabled={updateHint !== null} content={updateHint} cursor="not-allowed">
                  <button
                    type="button"
                    disabled={pending || updateHint !== null}
                    onClick={() => onRequestUnassign(employee)}
                    aria-label={copy.unassignEmployeeAria(name)}
                    className="-mr-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </Tooltip>
              </span>
            )
          })}
        </div>
      )}
      <Tooltip enabled={updateHint !== null} content={updateHint} cursor="not-allowed">
        <AdminActionButton
          label={`+ ${copy.assignLine}`}
          variant="ghost"
          size="sm"
          disabled={pending || updateHint !== null}
          onClick={onRequestAssign}
          className="px-2"
        />
      </Tooltip>
    </div>
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
  pending,
  hints = NO_ORDER_PERMISSION_HINTS,
  onRequestAssign,
  onRequestUnassign,
  onToggleRequiresPrepayment,
  onSavePrepaymentAmount,
  onAddLine,
  onRemoveLines,
}: OrderLinesGridProps) {
  const copy = useCopy(ordersCopy)
  const { locale } = useLocale()
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-neutral-900">{copy.linesTitle}</h3>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <Tooltip enabled={hints.delete !== null} content={hints.delete} cursor="not-allowed">
              <button
                type="button"
                disabled={pending || hints.delete !== null}
                onClick={removeSelected}
                className="min-h-9 rounded-lg px-3 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={copy.removeLine}
              >
                × {copy.removeLineSelected(selected.size)}
              </button>
            </Tooltip>
          )}
          {/* `AddLine` — `Create` на бэке, не `Update`: строка заказа заводится, а не правится. */}
          <Tooltip enabled={hints.create !== null} content={hints.create} cursor="not-allowed">
            <button
              type="button"
              disabled={pending || hints.create !== null}
              onClick={onAddLine}
              className="min-h-9 rounded-lg bg-neutral-950 px-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={copy.addLine}
            >
              + {copy.addLine}
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-50 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              <th className="w-10 px-3 py-2.5" />
              <th className="px-3 py-2.5">{copy.colProduct}</th>
              <th className="w-28 px-3 py-2.5">{copy.colDate}</th>
              <th className="w-20 px-3 py-2.5 text-right">{copy.colGuests}</th>
              <th className="w-64 px-3 py-2.5">{copy.colEmployees}</th>
              <th className="w-56 px-3 py-2.5">{copy.colPrepayment}</th>
              <th className="w-28 px-3 py-2.5 text-right">{copy.colPrice}</th>
              <th className="w-20 px-3 py-2.5 text-right">{copy.colDiscount}</th>
              <th className="w-28 px-3 py-2.5 text-right">{copy.colTotal}</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.id} className="border-t border-neutral-100">
                <td className="px-3 py-2.5">
                  <Checkbox
                    label=""
                    aria-label={copy.selectLine(line.tourTitle ?? String(line.tourId))}
                    checked={selected.has(line.id)}
                    onChange={() => toggleSelected(line.id)}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    to={`/admin/tours/${line.tourId}/edit`}
                    target="_blank"
                    className="text-neutral-900 hover:underline"
                  >
                    {line.tourTitle ?? copy.tourFallback(line.tourId)}
                  </Link>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-neutral-700">{line.tourDate}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-neutral-700">{line.guestCount}</td>
                <td className="px-3 py-2.5 align-top">
                  <LineEmployeesCell
                    line={line}
                    pending={pending}
                    updateHint={hints.update}
                    onRequestAssign={() => onRequestAssign(line.id)}
                    onRequestUnassign={(employee) =>
                      onRequestUnassign({
                        lineId: line.id,
                        employeeId: employee.employeeId,
                        employeeName: employee.employeeFullName,
                      })
                    }
                  />
                </td>
                <td className="px-3 py-2.5">
                  {/* Предоплата — `UpdateLine` (`Update`). Гейтится вместе с Save: иначе правки
                      копились бы в черновик, который этот пользователь никогда не сможет
                      сохранить. Тултип один на всю пару контролов, а не по одному на каждый. */}
                  <Tooltip enabled={hints.update !== null} content={hints.update} cursor="not-allowed">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        label=""
                        aria-label={copy.colPrepayment}
                        checked={line.requiresPrepayment}
                        disabled={pending || hints.update !== null}
                        onChange={(e) => onToggleRequiresPrepayment(line, e.target.checked)}
                      />
                      {line.requiresPrepayment && (
                        <PrepaymentAmountInput
                          line={line}
                          disabled={pending || hints.update !== null}
                          onChange={(amount) => onSavePrepaymentAmount(line, amount)}
                        />
                      )}
                    </div>
                  </Tooltip>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-neutral-700">
                  {formatOrderMoney(line.priceSnapshot, order.currency, locale)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-neutral-900">
                  {line.discountPercent ? copy.discountBadge(line.discountPercent) : copy.dash}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-neutral-900">
                  {formatOrderMoney(line.lineTotal, order.currency, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
