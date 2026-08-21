import type { ReactNode } from 'react'

export interface AdminSummaryRow {
  label: string
  value: ReactNode
  /** The totals row (e.g. "Итого") — bigger/bolder, set off with a top rule. Expected at most once
   * per panel, conventionally last, but this component does not enforce either. */
  emphasis?: boolean
  /** Optional stable key, for callers that reorder/filter rows. Falls back to the row's index. */
  key?: string
}

export interface AdminSummaryPanelProps {
  rows: AdminSummaryRow[]
  /** Optional heading above the rows (e.g. "Итоги по заказу"). */
  title?: string
  className?: string
}

/**
 * Compact "label left / value right" summary — the Acumatica-style order sidebar (checklist
 * `order-toolbar-summary-checklist-2026-08-21.txt` §general context/mockup). Deliberately generic:
 * takes a plain array of rows rather than order-specific fields, so it works whether the caller
 * hands it 3 rows (a short draft) or 7+ (guests, price, discount, prepayment, paid, due, total) —
 * each row is its own flex line rather than a fixed-height grid, so the panel's height is just
 * `rows.length` and never clips or over-pads either case.
 *
 * `emphasis` is for exactly the kind of line Acumatica sets off with a rule above the grand total:
 * bigger/bolder text, `border-t` in place of the divider the other rows get from `divide-y`.
 */
export function AdminSummaryPanel({ rows, title, className = '' }: AdminSummaryPanelProps) {
  return (
    <div className={`overflow-hidden rounded-xl border border-neutral-200 bg-white ${className}`}>
      {title && (
        <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 text-[11px] font-bold tracking-[.12em] text-neutral-500 uppercase">
          {title}
        </div>
      )}
      <dl className="flex flex-col px-4">
        {rows.map((row, index) => (
          <div
            key={row.key ?? index}
            className={`flex items-baseline justify-between gap-4 py-2 ${
              row.emphasis
                ? 'border-t-2 border-neutral-900 pt-3'
                : index > 0
                  ? 'border-t border-neutral-100'
                  : ''
            }`}
          >
            <dt
              className={`min-w-0 truncate ${
                row.emphasis ? 'text-sm font-semibold text-neutral-900' : 'text-sm text-neutral-500'
              }`}
            >
              {row.label}
            </dt>
            <dd
              className={`shrink-0 tabular-nums ${
                row.emphasis
                  ? 'text-[22px] font-bold tracking-tight text-neutral-900'
                  : 'text-sm font-semibold text-neutral-900'
              }`}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
