import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Marks the field as invalid: red border + `aria-invalid`. Pair with `Field`'s `error` text. */
  error?: boolean
  /**
   * Which palette to render in — same contract and same reasoning as `Select`/`DatePicker`/
   * `HelpButton` (see the long comment above `Select`'s own `surface` prop).
   *
   * The default stays `'admin'`, unlike those three: this primitive shipped admin-coloured and is
   * spread across ~40 admin call sites, so flipping the default would repaint the whole panel.
   * The public site's dark skin is opt-in per call site (`surface="public"`) — added 2026-08-29
   * for the transfer request builder, the first public screen that needs a text field.
   */
  surface?: 'public' | 'admin'
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { error = false, surface = 'admin', className = '', ...props },
  ref,
) {
  // Border/ring cross-fade on `--dur-micro` (2.4 §7). Same 150ms Tailwind defaulted to, now
  // named — a field's focus state is a colour change and keeps animating under
  // `prefers-reduced-motion`. `box-shadow` stays out of the transition so the focus ring
  // itself lands instantly.
  const base =
    'w-full rounded-lg border px-3 py-2 text-sm transition-colors duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)] focus:outline-none focus:ring-2 disabled:cursor-not-allowed'

  const palette =
    surface === 'admin'
      ? [
          'bg-white text-neutral-900 placeholder:text-neutral-400 disabled:bg-neutral-100 disabled:text-neutral-400',
          error
            ? 'border-rose-500 focus:border-rose-600 focus:ring-rose-600/20'
            : 'border-neutral-300 focus:border-neutral-900 focus:ring-neutral-900/15',
        ].join(' ')
      : [
          // Role tokens, not literals: the public site has a light skin too, and it flips on
          // `data-theme`. Height matches the 44px tap target every other public control keeps.
          'min-h-11 bg-panel-raised text-ink placeholder:text-ink-muted disabled:border-disabled-edge disabled:bg-disabled-bg disabled:text-disabled-ink',
          error
            ? 'border-danger focus:border-danger focus:ring-danger'
            : 'border-edge-strong hover:border-gold-line focus:border-gold-line focus:ring-focus',
        ].join(' ')

  return (
    <input
      ref={ref}
      aria-invalid={error || undefined}
      className={`${base} ${palette} ${className}`}
      {...props}
    />
  )
})
