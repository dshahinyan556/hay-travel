/**
 * Column contract of the catalog grid: a tab describes ONLY its columns (caption, optional «?»
 * help, width, how one cell renders) — the grid owns rows, selection, drag, statuses, detail rows
 * and the desktop-table / mobile-card switch. The factories below cover the common cell kinds so a
 * tab's column list reads as a declaration, not as markup.
 */

import type { ReactNode } from 'react'
import type { SelectOption } from '@/shared/ui'
import type { CatalogEntity, DraftRow } from '../lib/catalogDraft'
import { CellCheckbox, CellInput, CellSelect, type CellLayout } from './CatalogCells'

export interface CatalogCellContext<T extends CatalogEntity, V extends object> {
  row: DraftRow<T, V>
  /** False for a row marked «удалится», without the right permission, or while Save runs. */
  editable: boolean
  /** Validation messages are shown only after the first Save attempt, like the old forms did. */
  showErrors: boolean
  layout: CellLayout
  /** Human name of the row («Седан», «garni-temple», «Новая строка») for accessible labels. */
  rowLabel: string
  setField: <K extends keyof V>(field: K, value: V[K]) => void
}

export interface CatalogColumn<T extends CatalogEntity, V extends object> {
  id: string
  /** Visible caption (table header / card field label). */
  label: string
  /** Explanation behind a «?» next to the caption — never inline text (sync file rule). */
  help?: string
  /** Width classes for the table header, e.g. `w-32`. */
  className?: string
  align?: 'start' | 'end'
  /** Span both columns of the mobile card's two-column grid. */
  wideOnCard?: boolean
  render: (ctx: CatalogCellContext<T, V>) => ReactNode
}

/** Keys of `V` whose value type is `X`. */
export type FieldOf<V, X> = { [K in keyof V]-?: V[K] extends X ? K : never }[keyof V]

/** «Название EN — Седан» — the accessible name of one cell. */
export const cellLabel = (column: string, rowLabel: string): string => `${column} — ${rowLabel}`

const errorOf = <T extends CatalogEntity, V extends object>(ctx: CatalogCellContext<T, V>, field: keyof V) =>
  ctx.showErrors ? ctx.row.errors[field] : undefined

interface ColumnOptions {
  help?: string
  className?: string
  wideOnCard?: boolean
}

interface TextColumnOptions extends ColumnOptions {
  /** Digits only on mobile keyboards; right-aligned, tabular figures. */
  numeric?: boolean
  placeholder?: string
}

export function textColumn<T extends CatalogEntity, V extends object>(
  field: FieldOf<V, string>,
  label: string,
  { numeric = false, placeholder = '—', ...options }: TextColumnOptions = {},
): CatalogColumn<T, V> {
  return {
    id: String(field),
    label,
    align: numeric ? 'end' : 'start',
    ...options,
    render: (ctx) => (
      <CellInput
        value={String(ctx.row.values[field])}
        onChange={(value) => ctx.setField(field, value as V[typeof field])}
        label={cellLabel(label, ctx.rowLabel)}
        editable={ctx.editable}
        layout={ctx.layout}
        changed={ctx.row.changed.has(field)}
        error={errorOf(ctx, field)}
        struck={ctx.row.status === 'deleted'}
        align={numeric ? 'end' : 'start'}
        inputMode={numeric ? 'numeric' : 'text'}
        placeholder={placeholder}
      />
    ),
  }
}

interface SelectColumnOptions extends ColumnOptions {
  placeholder?: string
  /** Disable the picker on every row, e.g. when its option list is not readable by the role. */
  disabled?: boolean
}

export function selectColumn<T extends CatalogEntity, V extends object>(
  field: FieldOf<V, string>,
  label: string,
  options: SelectOption[],
  { placeholder, disabled, ...rest }: SelectColumnOptions = {},
): CatalogColumn<T, V> {
  return {
    id: String(field),
    label,
    ...rest,
    render: (ctx) => (
      <CellSelect
        value={String(ctx.row.values[field])}
        onChange={(value) => ctx.setField(field, value as V[typeof field])}
        options={options}
        label={cellLabel(label, ctx.rowLabel)}
        editable={ctx.editable}
        disabled={disabled}
        layout={ctx.layout}
        changed={ctx.row.changed.has(field)}
        error={errorOf(ctx, field)}
        struck={ctx.row.status === 'deleted'}
        placeholder={placeholder}
      />
    ),
  }
}

export function checkboxColumn<T extends CatalogEntity, V extends object>(
  field: FieldOf<V, boolean>,
  label: string,
  options: ColumnOptions = {},
): CatalogColumn<T, V> {
  return {
    id: String(field),
    label,
    ...options,
    render: (ctx) => (
      <CellCheckbox
        checked={Boolean(ctx.row.values[field])}
        onChange={(checked) => ctx.setField(field, checked as V[typeof field])}
        label={cellLabel(label, ctx.rowLabel)}
        editable={ctx.editable}
        changed={ctx.row.changed.has(field)}
      />
    ),
  }
}
