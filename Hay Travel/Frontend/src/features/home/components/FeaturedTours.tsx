import { Link } from 'react-router'
import type { Tour } from '@/shared/types/tour'
import { TourCard } from '@/shared/ui'
import { ArrowRightIcon } from '@/shared/ui/icons'

/**
 * Home-page showcase.
 *
 * `items-stretch` (the grid default) plus `h-full` inside `TourCard` is what keeps every card
 * in a row the same height — the mechanism behind the aligned price line. Do not add
 * `items-start` here: it would collapse cards to their content height and the prices would
 * drift apart again, which is the exact bug the client reported.
 */
export function FeaturedTours({ tours }: { tours: readonly Tour[] }) {
  return (
    // First section after the hero: `pt-24 pb-32` per the 2.3 rhythm (hero → section), not the
    // ordinary `py-20 sm:py-28` other sections use.
    <section className="mx-auto w-full max-w-7xl px-4 pt-24 pb-32 sm:px-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-eyebrow">Избранное</p>
          <h2 className="text-gold-sheen h2-section mt-1.5">
            Маршруты, которые берут чаще всего
          </h2>
        </div>
        <Link
          to="/trips"
          className="inline-flex items-center gap-1.5 text-sm text-gold-ink transition-colors hover:text-accent-strong"
        >
          Весь каталог
          <ArrowRightIcon size={15} />
        </Link>
      </div>

      <div className="mt-10 grid gap-5 sm:mt-14 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        {tours.map((tour) => (
          <TourCard key={tour.id} tour={tour} />
        ))}
      </div>
    </section>
  )
}
