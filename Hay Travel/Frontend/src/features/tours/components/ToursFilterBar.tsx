import { useId, useRef } from 'react'
import { REGIONS } from '@/shared/data/armeniaRegions'
import { formatPrice } from '@/shared/lib/format'
import { Select, type SelectOption } from '@/shared/ui'
import { CloseIcon, MoonIcon, SunIcon } from '@/shared/ui/icons'
import { PRICE_STEP, type TourFilters } from '../hooks/useTourFilters'

interface ToursFilterBarProps {
  filters: TourFilters
  setFilter: <K extends keyof TourFilters>(key: K, value: TourFilters[K]) => void
  reset: () => void
  isFiltered: boolean
  priceCeiling: number
  /**
   * Cheapest price in the data, aligned down to `PRICE_STEP` — see `usePriceRange`.
   *
   * Optional and defaults to 0, which never clips the range: any product remains filterable even
   * if a call site does not pass it. Passing it only removes the dead stretch of track below the
   * cheapest product.
   */
  priceFloor?: number
  resultCount: number
}

const KIND_OPTIONS = [
  { value: 'all', label: 'Всё', Icon: null },
  { value: 'tour', label: 'Туры', Icon: MoonIcon },
  { value: 'excursion', label: 'Экскурсии', Icon: SunIcon },
] as const

/**
 * Built once at module scope: `REGIONS` is a static generated list, so there is nothing per-render
 * to recompute and no need for `useMemo`. A stable array also keeps `Select`'s internal callbacks
 * from being invalidated on every parent render.
 */
const REGION_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'Все регионы' },
  ...REGIONS.map((region) => ({ value: region.slug, label: region.ru })),
]

export function ToursFilterBar({
  filters,
  setFilter,
  reset,
  isFiltered,
  priceCeiling,
  priceFloor = 0,
  resultCount,
}: ToursFilterBarProps) {
  const priceInputId = useId()
  const regionSelectId = useId()
  const regionLabelId = useId()
  const kindButtonRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Both bounds snap to whole steps: a range input can only land on `min + n * step`, so with an
  // unaligned bound `max` itself would be unreachable — and reaching max is how the filter clears.
  const sliderMax = Math.ceil(Math.max(priceCeiling, 0) / PRICE_STEP) * PRICE_STEP
  const sliderMin = Math.min(
    Math.floor(Math.max(priceFloor, 0) / PRICE_STEP) * PRICE_STEP,
    sliderMax,
  )
  // An empty catalog leaves nothing to filter by price; a zero-width track would just be a thumb
  // that cannot move, so the control says so instead of pretending.
  const hasPriceRange = sliderMax > sliderMin
  // `null` means "no limit", which the slider shows as its right end. Clamped so a hand-written
  // `?maxPrice=5` cannot desync the rendered thumb from the value React thinks it has.
  const priceValue = Math.min(Math.max(filters.maxPrice ?? sliderMax, sliderMin), sliderMax)
  const priceLabel = formatPrice(priceValue, 'USD')

  // APG "radio group" pattern: arrow keys both move focus AND change the selection (unlike a
  // listbox, where arrows only move a highlight until Enter commits) — this is what makes native
  // radio buttons feel the way they do, and AT users expect the same here since the role says so.
  function handleKindKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % KIND_OPTIONS.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + KIND_OPTIONS.length) % KIND_OPTIONS.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = KIND_OPTIONS.length - 1
    }
    if (nextIndex === null) return
    event.preventDefault()
    setFilter('kind', KIND_OPTIONS[nextIndex].value)
    kindButtonRefs.current[nextIndex]?.focus()
  }

  return (
    <div className="rounded-2xl bg-panel p-4 ring-1 ring-edge sm:p-5">
      <div className="flex flex-wrap items-center gap-4">
        {/*
          Kind — a segmented control, since it's the primary axis (tour vs excursion), implemented
          as a real radio group: exactly one of the three is ever "on", so `role="radio"` +
          `aria-checked` is the correct semantics (not `role="group"` + `aria-pressed`, which
          describes independent toggles). Roving `tabIndex` keeps the whole group to one Tab stop,
          matching a native radio group.
        */}
        <div className="flex min-h-11 items-center rounded-full p-0.5 ring-1 ring-edge" role="radiogroup" aria-label="Тип продукта">
          {KIND_OPTIONS.map(({ value, label, Icon }, index) => {
            const active = filters.kind === value
            return (
              <button
                key={value}
                ref={(node) => {
                  kindButtonRefs.current[index] = node
                }}
                type="button"
                role="radio"
                aria-checked={active}
                tabIndex={active ? 0 : -1}
                onClick={() => setFilter('kind', value)}
                onKeyDown={(event) => handleKindKeyDown(event, index)}
                className={[
                  'inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                  active ? 'bg-wine text-gold-light' : 'text-ink-dim hover:text-gold-ink',
                ].join(' ')}
              >
                {Icon && <Icon size={14} />}
                {label}
              </button>
            )
          })}
        </div>

        {/*
          A plain `div`, not a wrapping `label`: `Select` renders a `<button role="combobox">`, and
          wrapping a button in a label associates nothing (and makes the caption swallow clicks).
          `htmlFor` + the control's `id` is what ties them together for click-to-focus; the label
          also carries its own `id` so `Select` can be pointed at it via `aria-labelledby` below —
          the single source of truth for this control's name, instead of a second literal string
          that could drift out of sync with the visible caption.
        */}
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor={regionSelectId} id={regionLabelId} className="whitespace-nowrap text-ink-muted">
            Регион
          </label>
          <Select
            id={regionSelectId}
            value={filters.region}
            // Region is a single deliberate choice, so it commits to the URL immediately —
            // unlike the price slider below, which streams values and is debounced in
            // `useTourFilters`. `SelectOption.value` is a plain string; the options come from
            // `REGIONS`, so every emitted value is a real `RegionSlug` (or the `'all'` default).
            onChange={(value) => setFilter('region', value as TourFilters['region'])}
            options={REGION_OPTIONS}
            aria-labelledby={regionLabelId}
            className="w-44"
            // Pill shape to sit flush with the segmented control and the reset button in the same
            // row — `Select`'s own 44px tap target and colors are untouched by this.
            triggerClassName="rounded-full px-3.5 py-2"
          />
        </div>

        {/*
          A plain `div` rather than a wrapping `label`: the caption is tied to the input by
          `htmlFor`, which both associates them for assistive tech and makes the caption a hit
          target that focuses the slider.
        */}
        <div className="flex min-w-[210px] flex-1 items-center gap-3 text-sm">
          <label htmlFor={priceInputId} className="whitespace-nowrap text-ink-muted">
            До {priceLabel}
          </label>
          <input
            id={priceInputId}
            type="range"
            min={sliderMin}
            max={sliderMax}
            step={PRICE_STEP}
            value={priceValue}
            disabled={!hasPriceRange}
            onChange={(e) => {
              const value = Number(e.target.value)
              // Dragging back to the ceiling means "no limit" — drop the param entirely.
              setFilter('maxPrice', value >= sliderMax ? null : value)
            }}
            className="flex-1 accent-[var(--accent-base)] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Максимальная цена"
            // Without this a screen reader announces a bare "300". `aria-label` deliberately keeps
            // the name stable (a name that changed on every step would be re-announced), so the
            // formatted amount is delivered here instead.
            aria-valuetext={`до ${priceLabel}`}
          />
        </div>

        {/*
          Live region: filtering happens without any page change, so a screen reader user would
          otherwise never learn that the list shrank. `atomic` so the whole phrase is read, not
          the lone number.
        */}
        <span className="text-sm text-ink-muted" aria-live="polite" aria-atomic="true">
          Найдено: <span className="text-gold-ink">{resultCount}</span>
        </span>

        {isFiltered && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-ink-dim transition-colors hover:text-gold-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <CloseIcon size={14} />
            Сбросить
          </button>
        )}
      </div>
    </div>
  )
}
