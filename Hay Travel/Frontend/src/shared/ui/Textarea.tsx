import { forwardRef } from 'react'
import type { TextareaHTMLAttributes } from 'react'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Marks the field as invalid: red border + `aria-invalid`. Pair with `Field`'s `error` text. */
  error?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { error = false, className = '', ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={error || undefined}
      className={`min-h-16 w-full resize-y rounded-lg border bg-white px-3 py-2 text-sm text-neutral-900 transition-colors placeholder:text-neutral-400 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400 ${
        error
          ? 'border-rose-500 focus:border-rose-600 focus:ring-rose-600/20'
          : 'border-neutral-300 focus:border-brand-600 focus:ring-brand-600/20'
      } ${className}`}
      {...props}
    />
  )
})
