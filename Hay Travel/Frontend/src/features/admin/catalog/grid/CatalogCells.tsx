/**
 * Cell editors of the catalog grid. Each one renders in two layouts:
 *  - `table` — looks like plain text until hovered/focused, then shows its field frame (mockup
 *    `.cell` / `.cell.edit`); a changed cell is tinted, an invalid one gets a red frame + message;
 *  - `card`  — the mobile card (≤767px), where every cell is a normal bordered field.
 * A non-editable cell (no permission, row marked «удалится», Save in flight) is plain text.
 */

import { useId, type ReactNode } from 'react'
import { Checkbox, Select, type SelectOption } from '@/shared/ui'

export type CellLayout = 'table' | 'card'

/** Frame shared by every non-input cell that has to show the "changed" tint. */
const changedRing = 'rounded-lg ring-2 ring-blue-300 ring-offset-1'

function CellError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="px-2 pt-0.5 text-[11px] leading-tight text-rose-600">
      {message}
    </p>
  )
}

interface CellTextProps {
  value: string
  placeholder?: string
  struck?: boolean
  align?: 'start' | 'end'
  layout: CellLayout
}

/** Read-only cell. */
export function CellText({ value, placeholder = '—', struck = false, align = 'start', layout }: CellTextProps) {
  const shown = value.trim() === '' ? placeholder : value
  return (
    <div
      title={value || undefined}
      // Right-aligned figures line up down a table column; on a card the value sits alone under its
      // caption, and pushing it to the far edge only detaches it from the label.
      className={`flex min-w-0 items-center truncate text-[13px] ${layout === 'table' ? 'h-8 px-2' : 'min-h-9 px-0.5'} ${
        align === 'end' && layout === 'table' ? 'justify-end tabular-nums' : ''
      } ${value.trim() === '' ? 'text-neutral-400' : 'text-neutral-800'} ${struck ? 'text-neutral-400 line-through' : ''}`}
    >
      <span className="truncate">{shown}</span>
    </div>
  )
}

export interface CellInputProps {
  value: string
  onChange: (value: string) => void
  /** Accessible name — column caption plus row name, e.g. «Название EN — Седан». */
  label: string
  editable: boolean
  layout: CellLayout
  changed?: boolean
  error?: string
  struck?: boolean
  align?: 'start' | 'end'
  inputMode?: 'text' | 'numeric' | 'decimal'
  placeholder?: string
}

export function CellInput({
  value,
  onChange,
  label,
  editable,
  layout,
  changed = false,
  error,
  struck,
  align = 'start',
  inputMode = 'text',
  placeholder,
}: CellInputProps) {
  const errorId = useId()
  if (!editable) return <CellText value={value} placeholder={placeholder} struck={struck} align={align} layout={layout} />

  const frame =
    layout === 'table'
      ? `h-8 rounded-[7px] border px-2 ${
          error
            ? 'border-rose-500 bg-rose-50'
            : `border-transparent hover:border-neutral-300 ${changed ? 'bg-blue-50' : 'bg-transparent'}`
        } focus:border-neutral-900 focus:bg-white`
      : `h-9 rounded-lg border px-2.5 ${
          error ? 'border-rose-500 bg-rose-50' : `border-neutral-300 ${changed ? 'bg-blue-50' : 'bg-white'}`
        } focus:border-neutral-900`

  return (
    <div className="min-w-0">
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        placeholder={placeholder}
        className={`w-full min-w-0 text-[13px] text-neutral-900 transition-colors duration-[var(--dur-micro)] placeholder:text-neutral-400 focus:outline-none focus:ring-[3px] focus:ring-neutral-900/10 ${
          align === 'end' ? 'text-right tabular-nums' : ''
        } ${frame}`}
      />
      {error && <CellError id={errorId} message={error} />}
    </div>
  )
}

export interface CellSelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  label: string
  editable: boolean
  /** Rendered disabled even on an editable row — e.g. the region list the role cannot read. */
  disabled?: boolean
  layout: CellLayout
  changed?: boolean
  error?: string
  struck?: boolean
  placeholder?: string
}

export function CellSelect({
  value,
  onChange,
  options,
  label,
  editable,
  disabled = false,
  layout,
  changed = false,
  error,
  struck,
  placeholder,
}: CellSelectProps) {
  const errorId = useId()
  const selectedLabel = options.find((option) => option.value === value)?.label ?? ''
  if (!editable) return <CellText value={selectedLabel} placeholder={placeholder} struck={struck} layout={layout} />

  return (
    <div className="min-w-0">
      <div className={changed && !error ? changedRing : ''}>
        <Select
          surface="admin"
          value={value}
          onChange={onChange}
          options={options}
          placeholder={placeholder}
          disabled={disabled}
          error={Boolean(error)}
          aria-label={label}
          aria-describedby={error ? errorId : undefined}
          className="w-full"
          triggerClassName={layout === 'table' ? 'rounded-[7px] px-2 py-1 text-[13px]' : undefined}
        />
      </div>
      {error && <CellError id={errorId} message={error} />}
    </div>
  )
}

export interface CellCheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  editable: boolean
  changed?: boolean
}

export function CellCheckbox({ checked, onChange, label, editable, changed = false }: CellCheckboxProps) {
  return (
    <span className={`inline-flex px-1.5 ${changed ? changedRing : ''}`}>
      <Checkbox
        label={label}
        labelHidden
        checked={checked}
        disabled={!editable}
        onChange={(e) => onChange(e.target.checked)}
      />
    </span>
  )
}

/** Tint for a custom (non-text) cell editor whose value differs from the saved one. */
export function ChangedFrame({ changed, children }: { changed: boolean; children: ReactNode }) {
  return <span className={`inline-flex ${changed ? `${changedRing} px-1` : ''}`}>{children}</span>
}
