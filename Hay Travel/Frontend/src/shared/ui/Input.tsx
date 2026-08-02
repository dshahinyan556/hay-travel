import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Marks the field as invalid: red border + `aria-invalid`. Pair with `Field`'s `error` text. */
  error?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { error = false, className = '', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={error || undefined}
      // Border/ring cross-fade on `--dur-micro` (2.4 §7). Same 150ms Tailwind defaulted to, now
      // named — a field's focus state is a colour change and keeps animating under
      // `prefers-reduced-motion`. `box-shadow` stays out of the transition so the focus ring
      // itself lands instantly.
      className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-neutral-900 transition-colors duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)] placeholder:text-neutral-400 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400 ${
        error
          ? 'border-rose-500 focus:border-rose-600 focus:ring-rose-600/20'
          : 'border-neutral-300 focus:border-brand-600 focus:ring-brand-600/20'
      } ${className}`}
      {...props}
    />
  )
})
