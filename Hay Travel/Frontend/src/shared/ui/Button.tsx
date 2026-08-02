import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800',
  secondary: 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200',
  ghost: 'bg-transparent text-neutral-900 hover:bg-neutral-100',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
}

/**
 * Class-name builder shared between the native `<button>` below and navigational CTAs
 * that must render as a router `<Link>` instead (e.g. "Смотреть туры" on the homepage
 * hero). Keeps both in visual sync without a polymorphic `as` prop.
 *
 * Motion (2.4): colour only, on `--dur-micro`/`--ease-in-out-soft` — the same 150ms Tailwind
 * defaulted to, now named rather than implicit. The hover lift and press-shrink of §2/§2a live in
 * the `.btn-motion` class (`index.css`) and are NOT applied here on purpose: every consumer of
 * this builder today is inside `/admin`, whose look is out of scope, while the public site's CTAs
 * are their own components. A public CTA that wants the full treatment adds `btn-motion`.
 */
export function buttonClassName(variant: ButtonVariant = 'primary', size: ButtonSize = 'md'): string {
  return `inline-flex cursor-pointer items-center justify-center rounded-lg font-medium transition-colors duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]}`
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
  return <button className={`${buttonClassName(variant, size)} ${className}`} {...props} />
}
