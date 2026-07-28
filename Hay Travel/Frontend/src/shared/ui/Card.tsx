import type { ReactNode } from 'react'

export type CardPadding = 'sm' | 'md' | 'lg'

export interface CardProps {
  children: ReactNode
  className?: string
  /** @default 'md' */
  padding?: CardPadding
}

const paddingClasses: Record<CardPadding, string> = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
}

/**
 * Plain panel container: white background, neutral border, soft shadow, rounded corners.
 * Use `padding="sm"` for dense panels (e.g. tables that manage their own cell padding —
 * pass `padding="sm"` or override via `className` and let the table fill the card).
 */
export function Card({ children, className = '', padding = 'md' }: CardProps) {
  return (
    <div className={`rounded-xl border border-neutral-200 bg-white shadow-sm ${paddingClasses[padding]} ${className}`}>
      {children}
    </div>
  )
}
