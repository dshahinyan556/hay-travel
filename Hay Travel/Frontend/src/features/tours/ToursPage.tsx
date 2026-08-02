import { useLoaderData, useNavigation } from 'react-router'
import { motion } from 'framer-motion'
import { getTours } from '@/shared/api/tours'
import { getContentText, type ContentText } from '@/shared/api/siteSettings'
import type { Tour } from '@/shared/types/tour'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { Reveal, TourCard, TourCardSkeleton } from '@/shared/ui'
import { CompassIcon } from '@/shared/ui/icons'
import { ToursFilterBar } from './components/ToursFilterBar'
import { applyTourFilters, usePriceRange, useTourFilters } from './hooks/useTourFilters'

export async function toursLoader() {
  // `getContentText` never rejects (degrades internally) — a broken settings read can't take
  // the catalog page down, same contract as `HomePage`'s `getHeroContent`/`getContentText`.
  const [tours, content] = await Promise.all([getTours(), getContentText()])
  return { tours, content }
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
  const { tours, content } = useLoaderData() as { tours: readonly Tour[]; content: ContentText }
  const { filters, setFilter, reset, isFiltered } = useTourFilters()
  const { floor: priceFloor, ceiling: priceCeiling } = usePriceRange(tours)
  const navigation = useNavigation()
  const { t } = useLocale()

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
      (pendingParams.get('region') ?? '') !== filters.region.join(','))

  return (
    <div>
      {/*
        Page-opening band (2.3), not a second hero: a low, full-bleed `panel`-tone strip carrying
        the veil wash, fading back into `--surface-page` at its own bottom edge. `.band-veil`
        handles both. The rest of the page (filters + grid) sits below at the ordinary container
        width/padding, since nothing there is a large heading.
      */}
      <div className="band-veil relative w-full overflow-hidden pt-24 pb-18">
        {/* The band's background stays put; only its content rises (2.4). */}
        <Reveal as="div" className="mx-auto w-full max-w-7xl px-4 sm:px-16">
          <p className="section-eyebrow">{t('tours.eyebrow')}</p>
          <h1 className="text-gold-sheen h1-page mt-1.5">{content.catalogTitle}</h1>
          <p className="mt-2 max-w-xl text-sm text-ink-muted">{content.catalogSubtitle}</p>
        </Reveal>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 pt-10 pb-14 sm:px-6">
        <Reveal as="div">
          <ToursFilterBar
            filters={filters}
            setFilter={setFilter}
            reset={reset}
            isFiltered={isFiltered}
            priceCeiling={priceCeiling}
            priceFloor={priceFloor}
            resultCount={visible.length}
          />
        </Reveal>

        {/*
          The reveal GROUP is this always-mounted wrapper, not the grid itself (2.4).

          Two things depend on that. It must outlive the grid, which unmounts on every kind/region
          change (the skeleton takes its place) and does not exist at all when the filters match
          nothing — an observer attached to the grid would be thrown away with it, and cards
          mounting later into a group that never revealed would sit at `opacity: 0` forever. And it
          must be revealed BEFORE those cards mount, because that is exactly what stops the wave
          from replaying: a child mounting into an already-revealed group resolves straight to the
          final state, and a transition never runs on first style computation.

          The wrapper carries no classes of its own, so it adds nothing to the layout.
        */}
        <Reveal group as="div">
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
              <p className="mt-4 font-display text-2xl text-ink">{t('tours.empty.title')}</p>
              <p className="mt-2 max-w-sm text-sm text-ink-muted">{t('tours.empty.body')}</p>
              <button
                type="button"
                onClick={reset}
                className="btn-motion mt-5 rounded-full px-5 py-2.5 text-sm text-gold-ink ring-1 ring-gold-line hover:bg-accent-soft"
              >
                {t('tours.empty.reset')}
              </button>
            </div>
          ) : (
            /*
              The `<div>` wrappers exist because `.reveal-item` and `TourCard`'s own `.card-lift`
              both declare `transform` and must not share an element; `grid` on the wrapper keeps
              each card a stretched grid item, which is what holds the price line aligned across a
              row (see `FeaturedTours`).
            */
            <motion.div
              layout
              className="mt-8 grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4"
            >
              {visible.map((tour) => (
                <div key={tour.id} className="reveal-item grid">
                  <TourCard tour={tour} />
                </div>
              ))}
            </motion.div>
          )}
        </Reveal>
      </div>
    </div>
  )
}
