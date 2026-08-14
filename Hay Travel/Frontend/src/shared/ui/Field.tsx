import type { ReactNode } from 'react'
import { HelpButton } from './HelpButton'

export interface FieldProps {
  /** Visible label text. Omit for a field that already carries its own label (e.g. Checkbox). */
  label?: string
  /** Must match the wrapped control's `id` so the label is programmatically associated. */
  htmlFor?: string
  required?: boolean
  /** Error message. Switches the label/message to the error color. Blocking — see `warning` for
   * the non-blocking counterpart. */
  error?: string
  /**
   * Non-blocking, ALWAYS-VISIBLE notice below the control (e.g. "this URL looks incomplete") —
   * deliberately NOT routed through `HelpButton`: it exists to catch the admin's eye right now,
   * and hiding it behind a click would defeat that. Suppressed while `error` is set.
   */
  warning?: string
  /** Explanation of the field, surfaced through a `HelpButton` next to the label rather than as
   * always-on text — same pattern `PhoneField`/`UserDetailHeader` already use (F14, extended to
   * every admin form 2026-08-14: an always-visible caption under EVERY field was noise once a
   * screen had more than a couple of them). */
  hint?: string
  children: ReactNode
  className?: string
}

/**
 * Generic field wrapper: label (+ required marker + help trigger) above the control,
 * error/warning below. Pass any input-like primitive (Input, Textarea, Select, ...) as
 * `children` — this component owns layout and messaging only, never the control itself.
 */
export function Field({
  label,
  htmlFor,
  required,
  error,
  warning,
  hint,
  children,
  className = '',
}: FieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <div className="flex items-center gap-1.5">
          <label htmlFor={htmlFor} className="text-sm font-semibold text-neutral-700">
            {label}
            {required && (
              <span aria-hidden="true" className="ml-0.5 text-rose-700">
                *
              </span>
            )}
          </label>
          {hint && (
            <HelpButton surface="admin" title={label ?? ''}>
              {hint}
            </HelpButton>
          )}
        </div>
      )}
      {children}
      {error ? (
        <p role="alert" className="text-xs font-medium text-rose-700">
          {error}
        </p>
      ) : warning ? (
        <p role="alert" className="text-xs font-medium text-amber-700">
          {warning}
        </p>
      ) : null}
    </div>
  )
}
