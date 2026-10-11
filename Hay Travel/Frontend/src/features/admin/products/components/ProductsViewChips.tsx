import { useCopy } from '@/shared/i18n/defineCopy'
import { productsCopy } from '../lib/productsCopy'
import type { ProductsView } from '../lib/productsModel'

export interface ProductsViewChipsProps {
  view: ProductsView
  onChange: (view: ProductsView) => void
  counts: Record<ProductsView, number>
}

const VIEWS: ProductsView[] = ['active', 'featured', 'archived']

/**
 * «Активные / Избранные / Архив» with counts — the same pill chips as the status filter of
 * `OrdersPage` (identical classes), because they do the same job: change what the list SHOWS.
 *
 * Phones: one row that scrolls sideways instead of wrapping (mockup's phone frame) — the chips
 * keep their 44px height and never squeeze their labels.
 */
export function ProductsViewChips({ view, onChange, counts }: ProductsViewChipsProps) {
  const copy = useCopy(productsCopy).views

  return (
    <div
      role="group"
      aria-label={copy.label}
      className="-mx-4 flex w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:p-0"
    >
      {VIEWS.map((id) => {
        const active = view === id
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(id)}
            className={`min-h-11 shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
              active
                ? 'bg-neutral-950 text-white'
                : 'bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50'
            }`}
          >
            {copy[id]} <span className="tabular-nums">{counts[id]}</span>
          </button>
        )
      })}
    </div>
  )
}
