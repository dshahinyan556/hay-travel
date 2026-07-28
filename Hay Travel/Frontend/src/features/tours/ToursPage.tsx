import { useLoaderData, useNavigation } from 'react-router'
import { motion } from 'framer-motion'
import { getTours } from '@/shared/api/tours'
import type { Tour } from '@/shared/types/tour'
import { TourCard, TourCardSkeleton } from '@/shared/ui'
import { CompassIcon } from '@/shared/ui/icons'
import { ToursFilterBar } from './components/ToursFilterBar'
import { applyTourFilters, usePriceRange, useTourFilters } from './hooks/useTourFilters'

export async function toursLoader() {
  return { tours: await getTours() }
}

/** Skeleton grid count — matches the widest layout (`xl:grid-cols-4`) times two rows. */
const SKELETON_COUNT = 8

/**
 * Catalog — the single "Путешествия" section, serving `/trips`.
 *
 * Tours and excursions live in one list; the only thing that narrows it is `?kind` in the URL
 * (owned by `useTourFilters`). The route deliberately knows nothing about the kind, and must
 * never pre-filter the list or override that param: an earlier version did exactly that and
 * silently overwrote the visitor's choice on the way down, so the kind switch looked alive but
 * did nothing. Legacy `/tours` and `/excursions` redirect here with the right `?kind`
 * (see `app/router.tsx`).
 */
export function ToursPage() {
  const { tours } = useLoaderData() as { tours: readonly Tour[] }
  const { filters, setFilter, reset, isFiltered } = useTourFilters()
  const { floor: priceFloor, ceiling: priceCeiling } = usePriceRange(tours)
  const navigation = useNavigation()

  const visible = applyTourFilters(tours, filters)

  /**
   * `kind`/`region` write to the URL and therefore re-run `toursLoader` — for the ~260ms of that
   * round trip, `useSearchParams` (and so `filters`) still reflects the OLD choice, so the grid
   * would otherwise sit there unfiltered and looking unresponsive to the click. `maxPrice` is
   * deliberately excluded: the slider renders from a local draft (see `useTourFilters`) and the
   * grid already reflects it instantly, so swapping in a skeleton during ITS background commit
   * would be a regression, not an improvement — the correct grid is already on screen.
   */
  const pendingParams = navigation.location ? new URLSearchParams(navigation.location.search) : null
  const isFilterNavigating =
    navigation.state === 'loading' &&
    pendingParams !== null &&
    ((pendingParams.get('kind') ?? 'all') !== filters.kind ||
      (pendingParams.get('region') ?? 'all') !== filters.region)

  return (
    <div>
      {/*
        Page-opening band (2.3), not a second hero: a low, full-bleed `panel`-tone strip carrying
        the veil wash, fading back into `--surface-page` at its own bottom edge. `.band-veil`
        handles both. The rest of the page (filters + grid) sits below at the ordinary container
        width/padding, since nothing there is a large heading.
      */}
      <div className="band-veil relative w-full overflow-hidden pt-24 pb-18">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-16">
          <p className="section-eyebrow">Каталог</p>
          <h1 className="text-gold-sheen h1-page mt-1.5">Путешествия</h1>
          <p className="mt-2 max-w-xl text-sm text-ink-muted">
            Туры и экскурсии по всем 11 регионам Армении. Экскурсия — один день без ночёвки, тур —
            два дня и больше.
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 pt-10 pb-14 sm:px-6">
        <ToursFilterBar
          filters={filters}
          setFilter={setFilter}
          reset={reset}
          isFiltered={isFiltered}
          priceCeiling={priceCeiling}
          priceFloor={priceFloor}
          resultCount={visible.length}
        />

        {isFilterNavigating ? (
          <div
            aria-hidden="true"
            className="mt-8 grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4"
          >
            {Array.from({ length: SKELETON_COUNT }, (_, i) => (
              <TourCardSkeleton key={i} />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="veil-top mt-16 flex flex-col items-center rounded-2xl border border-dashed border-edge px-6 py-12 text-center">
            <span className="text-gold-ink">
              <CompassIcon size={30} />
            </span>
            <p className="mt-4 font-display text-2xl text-ink">Под эти условия ничего нет</p>
            <p className="mt-2 max-w-sm text-sm text-ink-muted">
              Попробуйте убрать часть фильтров — например, поднять цену или выбрать другой регион.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-5 rounded-full px-5 py-2.5 text-sm text-gold-ink ring-1 ring-gold-line transition-colors hover:bg-accent-soft"
            >
              Сбросить фильтры
            </button>
          </div>
        ) : (
          <motion.div
            layout
            className="mt-8 grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4"
          >
            {visible.map((tour) => (
              <TourCard key={tour.id} tour={tour} />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}
