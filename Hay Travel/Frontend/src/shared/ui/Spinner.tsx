export type SpinnerSize = 'sm' | 'md' | 'lg'

export interface SpinnerProps {
  size?: SpinnerSize
  className?: string
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'h-3.5 w-3.5 border-2',
  md: 'h-5 w-5 border-2',
  lg: 'h-8 w-8 border-[3px]',
}

/**
 * Inherits color from the surrounding text (`currentColor`), so it matches whatever context
 * it's dropped into (e.g. white on a primary button, brand-700 standalone). No external
 * dependency — plain CSS animation via Tailwind's `animate-spin`.
 */
export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Загрузка"
      className={`inline-block animate-spin rounded-full border-current/30 border-t-current ${sizeClasses[size]} ${className}`}
    />
  )
}
