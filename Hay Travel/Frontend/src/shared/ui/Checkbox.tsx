import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes } from 'react'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Visible text next to the box. Checkbox always renders with a label — there is no bare variant. */
  label: string
  /** Extra classes on the outer `<label>` (the clickable row), not the `<input>` — e.g. to turn a
   * checkbox into a full-width hover-highlighted list row (`Select`'s searchable-list convention).
   * Additive: omit for the plain inline checkbox every other caller uses. */
  containerClassName?: string
  /**
   * Render `label` as `sr-only` instead of visible text. For grids where the caption already lives
   * in a column header (the permission matrix), so repeating it in every cell would be noise on
   * screen — but silence for a screen reader, which does not read column headers per cell.
   *
   * NOT a way to ship an unlabelled checkbox: `label` stays required and stays associated with the
   * input, so the accessible name is identical either way.
   */
  labelHidden?: boolean
}

/**
 * Labelled checkbox. `id` is auto-generated (via `useId`) when not provided, so `label` and
 * `input` stay associated without the consumer having to invent unique ids.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, id, className = '', containerClassName = '', labelHidden = false, disabled, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <label
      htmlFor={inputId}
      className={`inline-flex min-h-[28px] cursor-pointer items-center gap-2 ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${containerClassName}`}
    >
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        disabled={disabled}
        className={`h-[18px] w-[18px] shrink-0 rounded border-neutral-300 text-neutral-900 transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:ring-offset-0 disabled:cursor-not-allowed ${className}`}
        {...props}
      />
      <span className={labelHidden ? 'sr-only' : 'text-sm text-neutral-800'}>{label}</span>
    </label>
  )
})
