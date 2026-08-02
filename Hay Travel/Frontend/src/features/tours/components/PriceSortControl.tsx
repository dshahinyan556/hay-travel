import { useId, useRef, useState } from 'react'
import { formatPrice } from '@/shared/lib/format'
import { useIsCompactViewport } from '@/shared/hooks'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { Popover, Sheet, SHEET_SINGLE_DETENT } from '@/shared/ui'
import { ChevronDownIcon } from '@/shared/ui/icons'
import { PRICE_STEP, type TourSort } from '../hooks/useTourFilters'

interface PriceSortControlProps {
  id?: string
  minPrice: number | null
  maxPrice: number | null
  sort: TourSort
  onMinPriceChange: (value: number | null) => void
  onMaxPriceChange: (value: number | null) => void
  onSortChange: (value: TourSort) => void
  priceFloor: number
  priceCeiling: number
  'aria-labelledby'?: string
}

/**
 * Compact price control for the catalog filter bar — a popover/sheet trigger (same positioning
 * primitives as `RegionMultiSelect`: `Popover` on desktop, `Sheet` on a compact viewport) replacing
 * the old always-visible range slider, which alone was wide enough to force the filter row onto a
 * second line on medium viewports.
 *
 * Holds two independent axes — a min/max range and a sort order — since neither implies the
 * other: a sort with no range still narrows nothing, and a range with no sort still leaves order
 * untouched. Both live in one dropdown rather than two separate controls to keep the bar compact.
 */
export function PriceSortControl({
  id,
  minPrice,
  maxPrice,
  sort,
  onMinPriceChange,
  onMaxPriceChange,
  onSortChange,
  priceFloor,
  priceCeiling,
  'aria-labelledby': ariaLabelledBy,
}: PriceSortControlProps) {
  const generatedId = useId()
  const controlId = id ?? generatedId
  const isCompact = useIsCompactViewport()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { locale, t } = useLocale()

  const SORT_OPTIONS: { value: TourSort; label: string }[] = [
    { value: 'default', label: t('filter.price.sortDefault') },
    { value: 'price-asc', label: t('filter.price.sortCheaper') },
    { value: 'price-desc', label: t('filter.price.sortPricier') },
  ]

  // Dirty state only — never surfaced as text on the trigger. The trigger always reads
  // `filter.price.label` ("Цена"); a dirty range/sort is signalled purely by the button's own
  // colour treatment below (`isActive`), so the control never grows or shrinks with the value.
  const isActive = minPrice !== null || maxPrice !== null || sort !== 'default'
  const label = t('filter.price.label')

  function parseBound(raw: string): number | null {
    if (raw.trim() === '') return null
    const value = Number(raw)
    if (!Number.isFinite(value)) return null
    return Math.min(Math.max(value, 0), priceCeiling)
  }

  function blockMinusKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === '-') event.preventDefault()
  }

  const panel = (
    <div className="w-full p-4 lg:w-64">
      <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{t('filter.price.range')}</p>
      <div className="mt-2.5 flex items-center gap-2">
        <label className="flex-1 text-sm text-ink-dim">
          <span className="sr-only">{t('filter.price.from')}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={PRICE_STEP}
            placeholder={t('filter.price.fromPlaceholder', { value: formatPrice(priceFloor, locale) })}
            value={minPrice ?? ''}
            onChange={(e) => onMinPriceChange(parseBound(e.target.value))}
            onKeyDown={blockMinusKey}
            className="w-full appearance-none rounded-lg border border-edge-strong bg-panel-raised px-2.5 py-1.5 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </label>
        <span className="shrink-0 text-ink-muted">–</span>
        <label className="flex-1 text-sm text-ink-dim">
          <span className="sr-only">{t('filter.price.to')}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={PRICE_STEP}
            placeholder={t('filter.price.toPlaceholder', { value: formatPrice(priceCeiling, locale) })}
            value={maxPrice ?? ''}
            onChange={(e) => onMaxPriceChange(parseBound(e.target.value))}
            onKeyDown={blockMinusKey}
            className="w-full appearance-none rounded-lg border border-edge-strong bg-panel-raised px-2.5 py-1.5 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </label>
      </div>

      <p className="mt-4 text-xs font-semibold tracking-wide text-ink-muted uppercase">{t('filter.price.sort')}</p>
      <ul className="mt-2 space-y-1">
        {SORT_OPTIONS.map((option) => (
          <li key={option.value}>
            <label className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1 text-sm text-ink transition-colors hover:bg-accent-soft">
              <input
                type="radio"
                name={`${controlId}-sort`}
                checked={sort === option.value}
                onChange={() => onSortChange(option.value)}
                className="h-[16px] w-[16px] shrink-0 border-edge-strong accent-[var(--accent-base)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              />
              {option.label}
            </label>
          </li>
        ))}
      </ul>

      {isActive && (
        <button
          type="button"
          onClick={() => {
            onMinPriceChange(null)
            onMaxPriceChange(null)
            onSortChange('default')
          }}
          className="mt-3 text-xs text-ink-muted underline-offset-2 hover:text-gold-ink hover:underline"
        >
          {t('filter.price.reset')}
        </button>
      )}
    </div>
  )

  return (
    <div className="relative w-full sm:w-auto">
      <button
        ref={triggerRef}
        id={controlId}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={ariaLabelledBy}
        onClick={() => setOpen((o) => !o)}
        className={[
          'relative flex min-h-11 w-full items-center gap-2 rounded-full border px-3.5 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:w-auto',
          isActive
            ? 'border-gold-line bg-accent-soft text-gold-ink'
            : 'border-edge-strong bg-panel-raised text-ink hover:border-gold-line',
        ].join(' ')}
      >
        <span className="flex-1 whitespace-nowrap">{label}</span>
        <ChevronDownIcon size={16} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {isCompact ? (
        <Sheet open={open} onClose={() => setOpen(false)} ariaLabel={t('filter.price.label')} detents={SHEET_SINGLE_DETENT}>
          {panel}
        </Sheet>
      ) : (
        <Popover
          open={open}
          onClose={() => setOpen(false)}
          anchorRef={triggerRef}
          className="rounded-lg border border-edge-strong bg-panel-raised shadow-lg"
        >
          {panel}
        </Popover>
      )}
    </div>
  )
}
