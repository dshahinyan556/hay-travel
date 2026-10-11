import type { ReactNode } from 'react'
import { StarIcon } from '@/shared/ui/icons'
import type { ProductMetaPart } from '../lib/productsModel'

/**
 * Small presentational pieces shared by the three row kinds of the products list (active link
 * card, featured draft row, archive selectable row) — so the three stay one visual family.
 */

/** `struck` — a featured row marked «уберётся». */
export function ProductTitle({ text, empty, struck = false }: { text: string; empty: boolean; struck?: boolean }) {
  return (
    <span
      className={`block font-bold [overflow-wrap:anywhere] ${empty ? 'text-neutral-400' : 'text-neutral-900'} ${struck ? 'line-through' : ''}`}
    >
      {text}
    </span>
  )
}

/** The grey meta line under a title. `wide` parts are hidden on phones (mobile card = type and
 * duration only, per the mockup's phone frame). */
export function ProductMetaLine({ parts, extra }: { parts: ProductMetaPart[]; extra?: ReactNode }) {
  return (
    <span className="mt-0.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-xs text-neutral-500">
      {parts.map((part) => (
        <span key={part.text} className={part.wide ? 'hidden sm:inline' : undefined}>
          {part.text}
        </span>
      ))}
      {extra}
    </span>
  )
}

type BadgeTone = 'published' | 'hidden' | 'featured' | 'outline'

const badgeTone: Record<BadgeTone, string> = {
  published: 'bg-emerald-50 text-emerald-800',
  hidden: 'bg-neutral-100 text-neutral-500',
  featured: 'bg-amber-50 text-amber-800',
  outline: 'border border-neutral-300 bg-white text-neutral-700',
}

export function ProductBadge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${badgeTone[tone]}`}
    >
      {children}
    </span>
  )
}

export function FeaturedBadge({ label }: { label: string }) {
  return (
    <ProductBadge tone="featured">
      <StarIcon size={13} />
      {label}
    </ProductBadge>
  )
}

/** Draft-state tag next to a featured row: «перемещён» (blue) / «уберётся» (red). */
export function DraftTag({ tone, children }: { tone: 'moved' | 'removed'; children: ReactNode }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${
        tone === 'moved' ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700'
      }`}
    >
      {children}
    </span>
  )
}
