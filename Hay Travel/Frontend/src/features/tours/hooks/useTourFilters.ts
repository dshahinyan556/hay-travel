import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { REGION_BY_SLUG, type RegionSlug } from '@/shared/data/armeniaRegions'
import { useDeferredCommit } from '@/shared/hooks'
import type { Tour, TourKind } from '@/shared/types/tour'

/** Catalog sort order — `'default'` keeps the list in the order the API returned it. */
export type TourSort = 'default' | 'price-asc' | 'price-desc'

function isTourSort(value: string | null): value is TourSort {
  return value === 'price-asc' || value === 'price-desc'
}

export interface TourFilters {
  kind: TourKind | 'all'
  /** Regions to match, OR'd together. `[]` is the default (no filter — every region matches). */
  region: readonly RegionSlug[]
  minPrice: number | null
  maxPrice: number | null
  sort: TourSort
  /** Free-text match against the tour title. `''` is the default (no filter). */
  search: string
}

/** `?region=` holds comma-joined slugs. Unknown slugs (a hand-edited URL) are dropped rather than
 * left in `filters.region`, where they'd never match a tour and silently look like "nothing found"
 * instead of "no filter". */
function parseRegionParam(raw: string | null): RegionSlug[] {
  if (!raw) return []
  return raw.split(',').filter((slug): slug is RegionSlug => slug in REGION_BY_SLUG)
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

/**
 * Step the derived AMD price range is aligned to.
 *
 * AMD, like every price in the URL and in `Tour.priceFrom`. It was `10` while the site pretended
 * prices were USD — against real dram values in the tens of thousands that made the alignment a
 * no-op. The DISPLAY step of the filter inputs is a different number entirely: it comes from the
 * active currency's `roundingStep` (see `PriceSortControl`), which the backend ships per currency.
 */
export const PRICE_STEP = 1000

/** The ceiling is rounded up to this so the range ends on a tidy dram figure. */
const PRICE_CEILING_ALIGNMENT = 5000

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

  const rawMinPrice = params.get('minPrice')?.trim()
  const parsedMinPrice = rawMinPrice ? Number(rawMinPrice) : Number.NaN
  const urlMinPrice = Number.isFinite(parsedMinPrice) ? parsedMinPrice : null

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
          // `'all'` (kind), `'default'` (sort), `null`, `''` and `[]` are the defaults — omit
          // them so links stay clean. `Array.prototype.toString` (via the `String()` fallback
          // below) already comma-joins, which is exactly the `?region=lori,tavush` encoding
          // `parseRegionParam` expects back.
          if (
            value === 'all' ||
            value === 'default' ||
            value === null ||
            value === '' ||
            (Array.isArray(value) && value.length === 0)
          ) {
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

  const commitMinPrice = useCallback(
    (value: TourFilters['minPrice']) => {
      // `replace`, same reasoning as `commitMaxPrice` below: typing digits into the bound field is
      // a stream of edits, not a series of deliberate navigations.
      writeParam('minPrice', value, true)
    },
    [writeParam],
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
    value: draftMinPrice,
    set: setDraftMinPrice,
    sync: syncMinPrice,
  } = useDeferredCommit(urlMinPrice, commitMinPrice)
  const {
    value: draftMaxPrice,
    set: setDraftMaxPrice,
    sync: syncMaxPrice,
  } = useDeferredCommit(urlMaxPrice, commitMaxPrice)

  const urlSearch = params.get('search') ?? ''

  const commitSearch = useCallback(
    (value: TourFilters['search']) => {
      // Same reasoning as `commitMaxPrice`: a keystroke stream must not spawn a history entry
      // per character, so this overwrites the current one instead of pushing a new one.
      writeParam('search', value, true)
    },
    [writeParam],
  )

  // Same instant-draft/debounced-commit split as the price slider (see `commitMaxPrice`): typing
  // filters the grid immediately from the local draft, and only reaches the URL — a navigation —
  // once the user pauses.
  const { value: draftSearch, set: setDraftSearch, sync: syncSearch } = useDeferredCommit(urlSearch, commitSearch)

  const setFilter = useCallback(
    <K extends keyof TourFilters>(key: K, value: TourFilters[K]) => {
      if (key === 'minPrice') {
        setDraftMinPrice(value as TourFilters['minPrice'])
        return
      }
      if (key === 'maxPrice') {
        // TS cannot narrow `value` from a comparison on the generic key, but inside this branch
        // `K` is `'maxPrice'`, so the value is `number | null`.
        setDraftMaxPrice(value as TourFilters['maxPrice'])
        return
      }
      if (key === 'search') {
        setDraftSearch(value as TourFilters['search'])
        return
      }
      // Kind, region and sort are single deliberate choices: they push, so "Back" undoes them.
      writeParam(key, value, false)
    },
    [setDraftMinPrice, setDraftMaxPrice, setDraftSearch, writeParam],
  )

  const reset = useCallback(() => {
    // Drop the drafts together with the params, otherwise a commit scheduled a moment ago would
    // land right after the reset and put the price/search filter back.
    syncMinPrice(null)
    syncMaxPrice(null)
    syncSearch('')
    setParams(new URLSearchParams(), { preventScrollReset: true })
  }, [syncMinPrice, syncMaxPrice, syncSearch, setParams])

  const sortParam = params.get('sort')

  const filters: TourFilters = {
    kind: (params.get('kind') as TourKind | null) ?? 'all',
    region: parseRegionParam(params.get('region')),
    minPrice: draftMinPrice,
    maxPrice: draftMaxPrice,
    sort: isTourSort(sortParam) ? sortParam : 'default',
    search: draftSearch,
  }

  const isFiltered =
    filters.kind !== 'all' ||
    filters.region.length > 0 ||
    filters.minPrice !== null ||
    filters.maxPrice !== null ||
    filters.sort !== 'default' ||
    filters.search !== ''

  return { filters, setFilter, reset, isFiltered }
}

export function applyTourFilters(tours: readonly Tour[], filters: TourFilters): readonly Tour[] {
  const query = filters.search.trim().toLowerCase()
  const filtered = tours.filter((tour) => {
    if (filters.kind !== 'all' && tour.kind !== filters.kind) return false
    // OR across selected regions: a multi-day tour crossing several regions matches if ANY of
    // them is picked, not all — picking more regions should only ever widen the result set.
    if (filters.region.length > 0 && !filters.region.some((slug) => tour.regionSlugs.includes(slug))) return false
    if (filters.minPrice !== null && tour.priceFrom < filters.minPrice) return false
    if (filters.maxPrice !== null && tour.priceFrom > filters.maxPrice) return false
    if (query !== '' && !tour.title.toLowerCase().includes(query)) return false
    return true
  })
  // `.filter()` above always hands back a fresh array, so sorting it in place here never touches
  // the caller's own `tours`.
  if (filters.sort === 'price-asc') filtered.sort((a, b) => a.priceFrom - b.priceFrom)
  if (filters.sort === 'price-desc') filtered.sort((a, b) => b.priceFrom - a.priceFrom)
  return filtered
}

export interface PriceRange {
  floor: number
  ceiling: number
}

/**
 * Price bounds for the filter, in AMD, both derived from data so the control can never clip the
 * real range. A hardcoded floor used to make the cheapest excursions impossible to filter out at
 * all.
 */
export function usePriceRange(tours: readonly Tour[]): PriceRange {
  return useMemo(() => {
    if (tours.length === 0) return { floor: 0, ceiling: 0 }
    const prices = tours.map((t) => t.priceFrom)
    const ceiling = Math.ceil(Math.max(...prices) / PRICE_CEILING_ALIGNMENT) * PRICE_CEILING_ALIGNMENT
    // Floor rounds down to a whole step: a range input can only land on `min + n * step`, so an
    // unaligned floor would make `max` itself unreachable — and reaching max is how the filter
    // is cleared.
    const floor = Math.floor(Math.min(...prices) / PRICE_STEP) * PRICE_STEP
    // One product, or several at the same price, can collapse floor onto ceiling. Keep a step of
    // travel so the track is never zero-width.
    return { floor: Math.max(Math.min(floor, ceiling - PRICE_STEP), 0), ceiling }
  }, [tours])
}
