import type { ReactNode } from 'react'

export interface FieldProps {
  /** Visible label text. Omit for a field that already carries its own label (e.g. Checkbox). */
  label?: string
  /** Must match the wrapped control's `id` so the label is programmatically associated. */
  htmlFor?: string
  required?: boolean
  /** Error message. Takes precedence over `hint` and switches the label/message to the error color. */
  error?: string
  /** Helper text shown when there is no error. */
  hint?: string
  children: ReactNode
  className?: string
}

/**
 * Generic field wrapper: label (+ required marker) above the control, error/hint message
 * below. Pass any input-like primitive (Input, Textarea, Select, ...) as `children` — this
 * component owns layout and messaging only, never the control itself.
 */
export function Field({ label, htmlFor, required, error, hint, children, className = '' }: FieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-semibold text-neutral-700">
          {label}
          {required && (
            <span aria-hidden="true" className="ml-0.5 text-rose-700">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <p role="alert" className="text-xs font-medium text-rose-700">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-neutral-500">{hint}</p>
      ) : null}
    </div>
  )
}
