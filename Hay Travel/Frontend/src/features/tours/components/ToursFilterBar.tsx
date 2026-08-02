import { useId, useLayoutEffect, useRef, useState } from 'react'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { CloseIcon, MoonIcon, SearchIcon, SunIcon } from '@/shared/ui/icons'
import type { TourFilters } from '../hooks/useTourFilters'
import { PriceSortControl } from './PriceSortControl'
import { RegionMultiSelect } from './RegionMultiSelect'

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

export function ToursFilterBar({
  filters,
  setFilter,
  reset,
  isFiltered,
  priceCeiling,
  priceFloor = 0,
  resultCount,
}: ToursFilterBarProps) {
  const { t } = useLocale()
  const KIND_OPTIONS = [
    { value: 'all', label: t('filter.kind.all'), Icon: null },
    { value: 'tour', label: t('filter.kind.tour'), Icon: MoonIcon },
    { value: 'excursion', label: t('filter.kind.excursion'), Icon: SunIcon },
  ] as const

  const priceControlId = useId()
  const priceLabelId = useId()
  const searchInputId = useId()
  const regionSelectId = useId()
  const regionLabelId = useId()
  const kindGroupRef = useRef<HTMLDivElement>(null)
  const kindButtonRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [kindIndicator, setKindIndicator] = useState<{ left: number; width: number } | null>(null)

  const activeKindIndex = KIND_OPTIONS.findIndex((option) => option.value === filters.kind)

  // Measures the active button synchronously before paint, so the indicator never flashes at its
  // previous position (or at 0) for a frame — matches the pill instantly on mount and on every
  // kind change. A `ResizeObserver` on the group re-measures when the row's own width changes
  // (viewport resize, font load) without the active kind itself changing.
  useLayoutEffect(() => {
    const node = kindButtonRefs.current[activeKindIndex]
    if (node) setKindIndicator({ left: node.offsetLeft, width: node.offsetWidth })
  }, [activeKindIndex])

  useLayoutEffect(() => {
    const group = kindGroupRef.current
    if (!group) return
    const observer = new ResizeObserver(() => {
      const node = kindButtonRefs.current[activeKindIndex]
      if (node) setKindIndicator({ left: node.offsetLeft, width: node.offsetWidth })
    })
    observer.observe(group)
    return () => observer.disconnect()
  }, [activeKindIndex])

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
      {/*
        Explicit 2-row (desktop) / 4-row (mobile) layout from a single set of controls — no control
        is ever duplicated in the DOM (the kind segmented control in particular carries refs shared
        across every rendered instance for its sliding indicator, so two live copies would corrupt
        each other's measurement). Instead every item carries a responsive `order`, and a handful of
        invisible `basis-full` spacer elements (`sm:hidden` or `hidden sm:block`) force a line break
        at exactly the right point for each breakpoint. Row gap comes from the spacers' own height
        rather than the container's `gap`, so a forced break never doubles the visual spacing.
          Desktop: [search, found] / [kind, region, price, reset]
          Mobile:  [search] / [kind] / [region, price] / [found, reset]
      */}
      <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4">
        {/*
          A plain `div`, not a wrapping `label` (same reasoning as the region field below): the
          caption is tied to the input by `htmlFor`.
        */}
        <div className="order-1 flex min-w-0 flex-1 items-center gap-2 text-sm">
          <label htmlFor={searchInputId} className="sr-only">
            {t('filter.search.ariaLabel')}
          </label>
          <div className="relative w-full">
            <SearchIcon size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              id={searchInputId}
              type="search"
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              placeholder={t('filter.search.placeholder')}
              className="w-full min-h-11 rounded-full border border-edge-strong bg-panel-raised py-2 pl-9 pr-3 text-sm text-ink transition-colors duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)] placeholder:text-ink-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
          </div>
        </div>

        {/*
          Live region: filtering happens without any page change, so a screen reader user would
          otherwise never learn that the list shrank. `atomic` so the whole phrase is read, not
          the lone number. Sits next to the search field on desktop (row 1); moves down to sit next
          to Reset on mobile (row 4).
        */}
        <span
          className="order-8 shrink-0 whitespace-nowrap text-sm text-ink-muted sm:order-2"
          aria-live="polite"
          aria-atomic="true"
        >
          {t('filter.resultCount', { count: '' }).trim()} <span className="text-gold-ink">{resultCount}</span>
        </span>

        <div aria-hidden="true" className="order-2 h-3 w-full basis-full sm:hidden" />
        <div aria-hidden="true" className="hidden h-4 w-full basis-full sm:order-3 sm:block" />

        {/*
          Kind — a segmented control, since it's the primary axis (tour vs excursion), implemented
          as a real radio group: exactly one of the three is ever "on", so `role="radio"` +
          `aria-checked` is the correct semantics (not `role="group"` + `aria-pressed`, which
          describes independent toggles). Roving `tabIndex` keeps the whole group to one Tab stop,
          matching a native radio group.
        */}
        <div
          ref={kindGroupRef}
          className="relative order-3 flex min-h-11 w-full items-center rounded-full p-0.5 ring-1 ring-edge sm:order-4 sm:w-auto"
          role="radiogroup"
          aria-label={t('filter.kind.ariaLabel')}
        >
          {/* Sliding fill behind the active option — replaces the old instant `bg-wine` swap so
              switching Все/Туры/Экскурсии reads as one pill moving, not three buttons blinking.
              Positioned from measured DOM rects (`kindIndicator`), not percentages: the three
              labels have different widths (icon + text), so an even 1/3 split would either clip
              the longest label or leave visible gaps around the shorter ones. */}
          {kindIndicator && (
            <span
              aria-hidden="true"
              className="absolute inset-y-0.5 rounded-full bg-wine"
              style={{
                left: kindIndicator.left,
                width: kindIndicator.width,
                transition: 'left var(--dur-base) var(--ease-out-soft), width var(--dur-base) var(--ease-out-soft)',
              }}
            />
          )}
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
                  'relative z-10 flex-1 sm:flex-none inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                  active ? 'text-gold-light' : 'text-ink-dim hover:text-gold-ink',
                ].join(' ')}
              >
                {Icon && <Icon size={14} />}
                {label}
              </button>
            )
          })}
        </div>

        <div aria-hidden="true" className="order-4 h-3 w-full basis-full sm:hidden" />

        {/*
          Label is `sr-only` — the control's own text ("Все регионы" / a region name / a count)
          already says what it holds, so a separate "Регион" caption was redundant next to it.
          Still a real `<label>`, not a wrapping one (`RegionMultiSelect` renders a `<button>`, and
          wrapping a button in a label associates nothing): `htmlFor` + the control's `id` ties them
          together, and the label's own `id` feeds `aria-labelledby` below, so the accessible name
          survives even with nothing printed on screen.
        */}
        <div className="order-5 flex min-w-0 flex-1 items-center gap-2 text-sm sm:flex-none">
          <label htmlFor={regionSelectId} id={regionLabelId} className="sr-only">
            {t('filter.region.label')}
          </label>
          <RegionMultiSelect
            id={regionSelectId}
            value={filters.region}
            // Each toggle is a single deliberate choice, so it commits to the URL immediately —
            // unlike the price bounds in `PriceSortControl`, which stream keystrokes and are
            // debounced in `useTourFilters`.
            onChange={(value) => setFilter('region', value)}
            aria-labelledby={regionLabelId}
            className="flex-1 sm:w-44"
          />
        </div>

        {/*
          Same plain-`div` + `htmlFor` pairing as the region field above: `PriceSortControl`
          renders a `<button>` trigger, so a wrapping `label` would associate nothing. Row 3 on
          mobile with region — both `flex-1` and neither carrying a visible caption anymore, so the
          two controls land at equal width and together fill the panel's row instead of leaving
          dead space next to two narrow controls.
        */}
        <div className="order-6 flex min-w-0 flex-1 items-center gap-2 text-sm sm:flex-none">
          <label htmlFor={priceControlId} id={priceLabelId} className="sr-only">
            {t('filter.price.ariaLabel')}
          </label>
          <PriceSortControl
            id={priceControlId}
            minPrice={filters.minPrice}
            maxPrice={filters.maxPrice}
            sort={filters.sort}
            onMinPriceChange={(value) => setFilter('minPrice', value)}
            onMaxPriceChange={(value) => setFilter('maxPrice', value)}
            onSortChange={(value) => setFilter('sort', value)}
            priceFloor={priceFloor}
            priceCeiling={priceCeiling}
            aria-labelledby={priceLabelId}
          />
        </div>

        <div aria-hidden="true" className="order-7 h-3 w-full basis-full sm:hidden" />

        {/*
          Tertiary button — `.btn-motion` (2.4) replaces the old bare `transition-colors`, matching
          every other button in the app: same token-driven colour fade, plus the 1px hover lift and
          90ms press. Resting appearance is unchanged.

          Always mounted, never conditionally rendered: this used to be `{isFiltered && <button>}`,
          which drops the button out of (and back into) the flex row every time `isFiltered` flips —
          each flip reflowed the row, which read as the button (and its neighbours) jittering/
          blinking in place, and could also push the row onto a second line only while filtered,
          making the whole bar taller for no reason a visitor could see. Toggling opacity +
          pointer-events keeps the slot reserved, so the row's layout no longer depends on the
          filtered state at all.
        */}
        <button
          type="button"
          onClick={reset}
          aria-hidden={!isFiltered}
          tabIndex={isFiltered ? 0 : -1}
          className={`btn-motion order-9 ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-ink-dim transition-opacity duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)] hover:text-gold-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:order-7 ${
            isFiltered ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <CloseIcon size={14} />
          {t('filter.reset')}
        </button>
      </div>
    </div>
  )
}
