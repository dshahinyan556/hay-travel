import { Fragment, useState, type CSSProperties, type ReactNode } from 'react'
import { Checkbox, DragHandle, SortableList, type SortableRowRenderProps } from '@/shared/ui'
import { HelpButton } from '@/shared/ui/HelpButton'
import { HelpRevealZone } from '@/shared/ui/HelpReveal'
import { AlertIcon, ChevronDownIcon, ChevronRightIcon } from '@/shared/ui/icons'
import { useMediaQuery } from '@/shared/hooks'
import { useCopy } from '@/shared/i18n/defineCopy'
import type { ScreenPermission } from '@/shared/auth'
import { catalogCopy, type CatalogCopy } from '../lib/catalogCopy'
import type { CatalogEntity, DraftRow, RowKey } from '../lib/catalogDraft'
import type { CatalogTableDraft } from '../lib/useCatalogTableDraft'
import type { CatalogCellContext, CatalogColumn } from './catalogColumns'
import type { CellLayout } from './CatalogCells'

/** Below Tailwind `md` the table turns into cards (checklist 4.7) — same breakpoint where the
 * admin shell swaps its sidebar for the hamburger bar. */
const CARD_LAYOUT_QUERY = '(max-width: 767.98px)'

const rowKeyOf = <T extends CatalogEntity, V extends object>(row: DraftRow<T, V>): RowKey => row.key

/** Left accent of a row by its draft status (mockup `tr.chg` / `tr.new`), red for a failed save. */
function accentClass<T extends CatalogEntity, V extends object>(row: DraftRow<T, V>): string {
  if (row.serverError) return 'shadow-[inset_3px_0_0_#e11d48]'
  if (row.status === 'new') return 'shadow-[inset_3px_0_0_#16a34a]'
  if (row.status === 'changed') return 'shadow-[inset_3px_0_0_#1d4ed8]'
  return ''
}

export interface CatalogGridProps<T extends CatalogEntity, V extends object> {
  draft: CatalogTableDraft<T, V>
  /** Rows to show — the tab's search/filter already applied (new rows are never filtered out). */
  rows: DraftRow<T, V>[]
  columns: CatalogColumn<T, V>[]
  /** The four flags of THIS tab's own permission key. */
  permission: ScreenPermission
  /** Save in flight — the whole grid is read-only meanwhile. */
  locked: boolean
  showErrors: boolean
  /** The tab has a user-defined order at all (Regions don't). */
  reorderable: boolean
  /** False while a search/filter narrows the list: drag indices address the FULL order. */
  reorderEnabled: boolean
  /** The tab supports deleting rows (Regions don't) — adds the selection column. */
  selectable: boolean
  rowLabel: (row: DraftRow<T, V>) => string
  /** Singular noun for drag announcements, e.g. «Точка маршрута». */
  itemLabel: string
  /** Long fields that don't fit a cell (mockup: «строка-деталь» under the row). */
  renderDetail?: (ctx: CatalogCellContext<T, V>) => ReactNode
  /** Minimum table width on desktop, e.g. `min-w-[760px]` — the wrapper scrolls, never the page. */
  tableMinWidth: string
}

/**
 * The one grid every catalog tab renders through: desktop table or mobile cards, selection
 * checkboxes, drag-and-drop (into the draft, not to the server), «новая» / «изменено» /
 * «удалится» + «Вернуть» statuses, server errors under the failed row, optional detail row.
 * Data and transitions come from the tab's `CatalogTableDraft`; a tab supplies only columns.
 */
export function CatalogGrid<T extends CatalogEntity, V extends object>(props: CatalogGridProps<T, V>) {
  const isCards = useMediaQuery(CARD_LAYOUT_QUERY)
  const copy = useCopy(catalogCopy)
  const [expandedKey, setExpandedKey] = useState<RowKey | null>(null)
  const { draft, permission, locked, reorderable, reorderEnabled, selectable } = props

  const dragActive = reorderable && reorderEnabled && permission.canUpdate && !locked
  const selectionEnabled = selectable && permission.canDelete && !locked

  const contextOf = (row: DraftRow<T, V>, layout: CellLayout): CatalogCellContext<T, V> => ({
    row,
    layout,
    showErrors: props.showErrors,
    rowLabel: props.rowLabel(row),
    editable:
      !locked && row.status !== 'deleted' && (row.item === null ? permission.canCreate : permission.canUpdate),
    setField: (field, value) => draft.setField(row.key, field, value),
  })

  const shared: GridLayoutProps<T, V> = {
    ...props,
    copy,
    contextOf,
    dragActive,
    selectionEnabled,
    expandedKey,
    toggleExpanded: (key) => setExpandedKey((current) => (current === key ? null : key)),
  }
  return isCards ? <CatalogCards {...shared} /> : <CatalogTable {...shared} />
}

interface GridLayoutProps<T extends CatalogEntity, V extends object> extends CatalogGridProps<T, V> {
  copy: CatalogCopy
  contextOf: (row: DraftRow<T, V>, layout: CellLayout) => CatalogCellContext<T, V>
  dragActive: boolean
  selectionEnabled: boolean
  expandedKey: RowKey | null
  toggleExpanded: (key: RowKey) => void
}

/** Renders `rows` through `SortableList` when dragging is on, as a plain list otherwise. */
function SortableRows<T extends CatalogEntity, V extends object>({
  rows,
  dragActive,
  onReorder,
  itemLabel,
  children,
}: {
  rows: DraftRow<T, V>[]
  dragActive: boolean
  onReorder: (from: number, to: number) => void
  itemLabel: string
  children: (row: DraftRow<T, V>, sortable?: SortableRowRenderProps) => ReactNode
}) {
  if (!dragActive) return <>{rows.map((row) => <Fragment key={row.key}>{children(row)}</Fragment>)}</>
  return (
    <SortableList items={rows} getId={rowKeyOf} onReorder={onReorder} itemLabel={itemLabel}>
      {(row, _index, sortable) => children(row, sortable)}
    </SortableList>
  )
}

function RowDragHandle({
  sortable,
  label,
}: {
  sortable: SortableRowRenderProps | undefined
  label: string
}) {
  if (!sortable) return null
  return (
    <DragHandle ref={sortable.setActivatorNodeRef} label={label} {...sortable.attributes} {...sortable.listeners} />
  )
}

/** «новая» + «Убрать» / «изменено» / «удалится» + «Вернуть». */
function RowStatus<T extends CatalogEntity, V extends object>({
  row,
  name,
  copy,
  locked,
  onRestore,
  onDiscard,
}: {
  row: DraftRow<T, V>
  name: string
  copy: CatalogCopy
  locked: boolean
  onRestore: () => void
  onDiscard: () => void
}) {
  const tag = (text: string, tone: string) => (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${tone}`}>{text}</span>
  )
  const undo = (text: string, label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
      aria-label={label}
      className="rounded text-xs font-semibold text-neutral-700 underline underline-offset-2 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30 disabled:opacity-40"
    >
      {text}
    </button>
  )
  if (row.status === 'new') {
    return (
      <span className="inline-flex items-center gap-2">
        {tag(copy.common.statusNew, 'bg-emerald-50 text-emerald-700')}
        {undo(copy.common.discard, copy.common.discardRow(name), onDiscard)}
      </span>
    )
  }
  if (row.status === 'deleted') {
    return (
      <span className="inline-flex items-center gap-2">
        {tag(copy.common.statusDeleted, 'bg-rose-50 text-rose-700')}
        {undo(copy.common.restore, copy.common.restoreRow(name), onRestore)}
      </span>
    )
  }
  if (row.status === 'changed') return tag(copy.common.statusChanged, 'bg-blue-50 text-blue-700')
  return null
}

function ServerError({ message }: { message: string }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-rose-700">
      <AlertIcon size={14} className="mt-px shrink-0" />
      <span>{message}</span>
    </p>
  )
}

function ColumnCaption({ label, help }: { label: string; help?: string }) {
  return (
    // The «?» shows on hover of its caption only — always-visible help is reserved for touch, which
    // `HelpRevealZone` handles itself.
    <HelpRevealZone as="span" className="inline-flex items-center gap-1">
      {label}
      {help && (
        <HelpButton surface="admin" title={label}>
          {help}
        </HelpButton>
      )}
    </HelpRevealZone>
  )
}

/* -------------------------------------------------------------------------- */
/*  Desktop table                                                              */
/* -------------------------------------------------------------------------- */

function CatalogTable<T extends CatalogEntity, V extends object>(props: GridLayoutProps<T, V>) {
  const { rows, columns, draft, copy, selectable, selectionEnabled, reorderable, renderDetail, locked } = props
  const selectableKeys = rows.map((row) => row.key)
  const allSelected = selectableKeys.length > 0 && selectableKeys.every((key) => draft.selected.has(key))
  const colSpan = columns.length + 1 + (selectable ? 1 : 0) + (reorderable ? 1 : 0) + (renderDetail ? 1 : 0)

  function renderRow(row: DraftRow<T, V>, sortable?: SortableRowRenderProps) {
    const ctx = props.contextOf(row, 'table')
    const expanded = renderDetail !== undefined && props.expandedKey === row.key
    const deleted = row.status === 'deleted'
    const bg = deleted ? 'bg-rose-50/70' : expanded ? 'bg-neutral-50' : ''
    // The status accent goes on the FIRST cell (mockup `tr.chg td:first-child`) — a `<tr>` can't
    // carry an inset shadow across browsers.
    const firstKey = selectable ? 'select' : reorderable ? 'drag' : columns[0]?.id
    const accent = accentClass(row)
    const cls = (key: string, base: string) => (key === firstKey && accent ? `${base} ${accent}` : base)
    const cells: ReactNode[] = []

    if (selectable) {
      cells.push(
        <td key="select" className={cls('select', 'w-9 px-2.5 py-1.5')}>
          <Checkbox
            label={copy.common.selectRow(ctx.rowLabel)}
            labelHidden
            checked={draft.selected.has(row.key)}
            disabled={!selectionEnabled}
            onChange={(e) => draft.toggleSelected(row.key, e.target.checked)}
          />
        </td>,
      )
    }
    if (reorderable) {
      cells.push(
        <td key="drag" className={cls('drag', 'w-10 px-1 py-1.5')}>
          <RowDragHandle sortable={sortable} label={copy.common.dragToReorder(ctx.rowLabel)} />
        </td>,
      )
    }
    for (const column of columns) {
      cells.push(
        <td key={column.id} className={cls(column.id, 'px-1.5 py-1.5 align-top')}>
          {column.render(ctx)}
        </td>,
      )
    }
    cells.push(
      <td key="status" className="w-36 px-2 py-1.5">
        <RowStatus
          row={row}
          name={ctx.rowLabel}
          copy={copy}
          locked={locked}
          onRestore={() => draft.restore(row.key)}
          onDiscard={() => draft.remove([row.key])}
        />
      </td>,
    )
    if (renderDetail) {
      cells.push(
        <td key="detail" className="w-10 px-1 py-1.5">
          <button
            type="button"
            onClick={() => props.toggleExpanded(row.key)}
            aria-expanded={expanded}
            aria-label={expanded ? copy.common.hideDetails(ctx.rowLabel) : copy.common.showDetails(ctx.rowLabel)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30"
          >
            {expanded ? <ChevronDownIcon size={16} /> : <ChevronRightIcon size={16} />}
          </button>
        </td>,
      )
    }
    return (
      <>
        <tr
          ref={sortable?.setNodeRef}
          style={sortable?.style as CSSProperties | undefined}
          className={`border-b border-neutral-100 ${bg} ${sortable?.isDragging ? 'relative z-10 bg-white shadow-md' : ''}`}
        >
          {cells}
        </tr>
        {expanded && renderDetail && (
          <tr className="border-b border-neutral-100 bg-neutral-50">
            <td colSpan={colSpan} className="px-4 pb-4 pt-3">
              {renderDetail(ctx)}
            </td>
          </tr>
        )}
        {row.serverError && (
          <tr className="border-b border-neutral-100 bg-rose-50/60">
            <td colSpan={colSpan} className="px-4 py-2">
              <ServerError message={row.serverError} />
            </td>
          </tr>
        )}
      </>
    )
  }

  return (
    // `relative`: the header's `sr-only` captions are absolutely positioned — without a positioned
    // scroller they anchor to `<body>`, escape the clip and widen the whole page.
    <div className="relative overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className={`w-full ${props.tableMinWidth} text-left text-[13px]`}>
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            {selectable && (
              <th scope="col" className="w-9 px-2.5 py-2">
                <Checkbox
                  label={copy.common.selectAll}
                  labelHidden
                  checked={allSelected}
                  disabled={!selectionEnabled || selectableKeys.length === 0}
                  onChange={(e) => draft.setSelected(selectableKeys, e.target.checked)}
                />
              </th>
            )}
            {reorderable && (
              <th scope="col" className="w-10 px-1 py-2">
                <span className="sr-only">{copy.common.colOrder}</span>
              </th>
            )}
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={`whitespace-nowrap px-3 py-2 ${column.align === 'end' ? 'text-right' : ''} ${column.className ?? ''}`}
              >
                <ColumnCaption label={column.label} help={column.help} />
              </th>
            ))}
            <th scope="col" className="w-36 px-2 py-2">
              <span className="sr-only">{copy.common.colStatus}</span>
            </th>
            {renderDetail && (
              <th scope="col" className="w-10 px-1 py-2">
                <span className="sr-only">{copy.common.colDetails}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          <SortableRows rows={rows} dragActive={props.dragActive} onReorder={draft.reorder} itemLabel={props.itemLabel}>
            {renderRow}
          </SortableRows>
        </tbody>
      </table>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Mobile cards                                                               */
/* -------------------------------------------------------------------------- */

function CatalogCards<T extends CatalogEntity, V extends object>(props: GridLayoutProps<T, V>) {
  const { rows, columns, draft, copy, selectable, selectionEnabled, reorderable, renderDetail, locked } = props

  function renderCard(row: DraftRow<T, V>, sortable?: SortableRowRenderProps) {
    const ctx = props.contextOf(row, 'card')
    const expanded = renderDetail !== undefined && props.expandedKey === row.key
    const deleted = row.status === 'deleted'

    return (
      <li
        ref={sortable?.setNodeRef}
        style={sortable?.style as CSSProperties | undefined}
        className={`flex min-w-0 flex-col gap-2.5 rounded-xl border p-3 ${
          deleted ? 'border-rose-200 bg-rose-50/70' : 'border-neutral-200 bg-white'
        } ${accentClass(row)} ${sortable?.isDragging ? 'relative z-10 shadow-md' : ''}`}
      >
        <div className="flex min-w-0 items-center gap-2">
          {selectable && (
            <Checkbox
              label={copy.common.selectRow(ctx.rowLabel)}
              labelHidden
              checked={draft.selected.has(row.key)}
              disabled={!selectionEnabled}
              onChange={(e) => draft.toggleSelected(row.key, e.target.checked)}
            />
          )}
          {reorderable && <RowDragHandle sortable={sortable} label={copy.common.dragToReorder(ctx.rowLabel)} />}
          <span
            className={`min-w-0 flex-1 truncate text-sm font-bold ${deleted ? 'text-neutral-400 line-through' : 'text-neutral-900'}`}
          >
            {ctx.rowLabel}
          </span>
          <RowStatus
            row={row}
            name={ctx.rowLabel}
            copy={copy}
            locked={locked}
            onRestore={() => draft.restore(row.key)}
            onDiscard={() => draft.remove([row.key])}
          />
        </div>

        <div className="grid grid-cols-2 gap-x-2 gap-y-2.5">
          {columns.map((column) => (
            <div key={column.id} className={`min-w-0 ${column.wideOnCard ? 'col-span-2' : ''}`}>
              {/* Fixed caption height: a caption with a «?» button (32px) must not sit taller than its
                  neighbour, or the two fields of one row stop lining up. */}
              <div className="mb-1 flex h-8 items-center gap-1 text-[11px] font-semibold text-neutral-500">
                <ColumnCaption label={column.label} help={column.help} />
              </div>
              {column.render(ctx)}
            </div>
          ))}
        </div>

        {renderDetail && (
          <button
            type="button"
            onClick={() => props.toggleExpanded(row.key)}
            aria-expanded={expanded}
            aria-label={expanded ? copy.common.hideDetails(ctx.rowLabel) : copy.common.showDetails(ctx.rowLabel)}
            className="inline-flex h-9 items-center gap-1 self-start rounded-full border border-neutral-300 bg-white px-3.5 text-xs font-semibold text-neutral-800 transition-colors hover:border-neutral-400 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30"
          >
            {copy.common.details}
            {expanded ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
          </button>
        )}
        {expanded && renderDetail && <div className="border-t border-neutral-100 pt-3">{renderDetail(ctx)}</div>}
        {row.serverError && <ServerError message={row.serverError} />}
      </li>
    )
  }

  return (
    <ul className="flex flex-col gap-2.5">
      <SortableRows rows={rows} dragActive={props.dragActive} onReorder={draft.reorder} itemLabel={props.itemLabel}>
        {renderCard}
      </SortableRows>
    </ul>
  )
}
