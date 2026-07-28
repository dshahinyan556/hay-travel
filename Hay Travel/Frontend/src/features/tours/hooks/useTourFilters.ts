import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import type { RegionSlug } from '@/shared/data/armeniaRegions'
import { useDeferredCommit } from '@/shared/hooks'
import type { Tour, TourKind } from '@/shared/types/tour'

export interface TourFilters {
  kind: TourKind | 'all'
  region: RegionSlug | 'all'
  maxPrice: number | null
}

export interface UseTourFilters {
  /**
   * Filters to render *and* to filter the list by.
   *
   * `maxPrice` here is the optimistic value: it reflects the slider the instant it moves, ahead
   * of the URL. Because the catalog filters data it already has on the client, the grid and the
   * "Найдено: N" counter follow the finger without waiting for a navigation.
   */
  filters: TourFilters
  setFilter: <K extends keyof TourFilters>(key: K, value: TourFilters[K]) => void
  reset: () => void
  isFiltered: boolean
}

/** Step of the price slider — the derived price range is aligned to it. */
export const PRICE_STEP = 10

/**
 * Catalog filter state, stored in the URL rather than component state.
 *
 * The URL is the single source of truth so a filtered view is shareable, survives reload and
 * works with browser back/forward for free. Params are omitted when set back to their default,
 * which keeps clean links like `/trips` instead of `/trips?kind=all&region=all`.
 *
 * One exception to "the URL is the value": the price slider. Writing a search param is a
 * navigation that re-runs the route loader, so a value read straight back from the URL cannot
 * keep up with a drag, and with a real API behind the loader every pixel of movement would be an
 * HTTP request. The slider therefore renders from a local draft and commits to the URL only after
 * the movement settles (see `useDeferredCommit`). Discrete filters — kind, region — have no such
 * stream and are written immediately.
 */
export function useTourFilters(): UseTourFilters {
  const [params, setParams] = useSearchParams()

  const rawMaxPrice = params.get('maxPrice')?.trim()
  // A hand-edited `?maxPrice=abc` (or an empty `?maxPrice=`, which `Number` reads as 0) must not
  // silently hide every tour — anything unparseable is simply "no limit".
  const parsedMaxPrice = rawMaxPrice ? Number(rawMaxPrice) : Number.NaN
  const urlMaxPrice = Number.isFinite(parsedMaxPrice) ? parsedMaxPrice : null

  const writeParam = useCallback(
    <K extends keyof TourFilters>(key: K, value: TourFilters[K], replace: boolean) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          // `'all'` and `null` are the defaults — omit them so links stay clean.
          if (value === 'all' || value === null) {
            next.delete(key)
          } else {
            next.set(key, String(value))
          }
          return next
        },
        { preventScrollReset: true, replace },
      )
    },
    [setParams],
  )

  const commitMaxPrice = useCallback(
    (value: TourFilters['maxPrice']) => {
      // `replace`: a drag or a held arrow key produces a series of commits, and each one used to
      // push a history entry — ten arrow presses meant ten entries and a "Back" button that no
      // longer left the catalog. Refining a price is not navigation, so it overwrites the entry.
      writeParam('maxPrice', value, true)
    },
    [writeParam],
  )

  // Destructured so the callbacks below depend on the stable functions, not on a fresh object.
  const {
    value: draftMaxPrice,
    set: setDraftMaxPrice,
    sync: syncMaxPrice,
  } = useDeferredCommit(urlMaxPrice, commitMaxPrice)

  const setFilter = useCallback(
    <K extends keyof TourFilters>(key: K, value: TourFilters[K]) => {
      if (key === 'maxPrice') {
        // TS cannot narrow `value` from a comparison on the generic key, but inside this branch
        // `K` is `'maxPrice'`, so the value is `number | null`.
        setDraftMaxPrice(value as TourFilters['maxPrice'])
        return
      }
      // Kind and region are single deliberate choices: they push, so "Back" undoes them.
      writeParam(key, value, false)
    },
    [setDraftMaxPrice, writeParam],
  )

  const reset = useCallback(() => {
    // Drop the draft together with the params, otherwise a commit scheduled a moment ago would
    // land right after the reset and put the price filter back.
    syncMaxPrice(null)
    setParams(new URLSearchParams(), { preventScrollReset: true })
  }, [syncMaxPrice, setParams])

  const filters: TourFilters = {
    kind: (params.get('kind') as TourKind | null) ?? 'all',
    region: (params.get('region') as RegionSlug | null) ?? 'all',
    maxPrice: draftMaxPrice,
  }

  const isFiltered = filters.kind !== 'all' || filters.region !== 'all' || filters.maxPrice !== null

  return { filters, setFilter, reset, isFiltered }
}

export function applyTourFilters(tours: readonly Tour[], filters: TourFilters): readonly Tour[] {
  return tours.filter((tour) => {
    if (filters.kind !== 'all' && tour.kind !== filters.kind) return false
    if (filters.region !== 'all' && !tour.regionSlugs.includes(filters.region)) return false
    if (filters.maxPrice !== null && tour.priceFrom > filters.maxPrice) return false
    return true
  })
}

export interface PriceRange {
  floor: number
  ceiling: number
}

/**
 * Price bounds for the slider, both derived from data so the control can never clip the real
 * range. A hardcoded floor of 50 used to make the two cheapest excursions ($35 and $45)
 * impossible to filter out at all.
 */
export function usePriceRange(tours: readonly Tour[]): PriceRange {
  return useMemo(() => {
    if (tours.length === 0) return { floor: 0, ceiling: 0 }
    const prices = tours.map((t) => t.priceFrom)
    // Ceiling rounds up to the next 50 so the slider ends on a tidy number.
    const ceiling = Math.ceil(Math.max(...prices) / 50) * 50
    // Floor rounds down to a whole step: a range input can only land on `min + n * step`, so an
    // unaligned floor would make `max` itself unreachable — and reaching max is how the filter
    // is cleared.
    const floor = Math.floor(Math.min(...prices) / PRICE_STEP) * PRICE_STEP
    // One product, or several at the same price, can collapse floor onto ceiling. Keep a step of
    // travel so the track is never zero-width.
    return { floor: Math.max(Math.min(floor, ceiling - PRICE_STEP), 0), ceiling }
  }, [tours])
}
