import { Link, useLoaderData, type LoaderFunctionArgs } from 'react-router'
import { getTourBySlug, getToursByRegion } from '@/shared/api/tours'
import { REGION_BY_SLUG } from '@/shared/data/armeniaRegions'
import type { Tour } from '@/shared/types/tour'
import { formatDuration, formatPrice, formatReviewCount } from '@/shared/lib/format'
import { BadgeChip, KindChip, TourCard } from '@/shared/ui'
import { CheckIcon, ClockIcon, CloseIcon, MapPinIcon, StarIcon } from '@/shared/ui/icons'
import { TourGallery } from './components/TourGallery'
import { TourItinerary } from './components/TourItinerary'
import { BookingCard } from './components/BookingCard'

export async function tourDetailLoader({ params }: LoaderFunctionArgs) {
  const tour = await getTourBySlug(params.slug!)
  if (!tour) {
    // Surfaces as the route error boundary rather than rendering an empty page.
    throw new Response('Тур не найден', { status: 404 })
  }
  // "Similar" = shares the first region. Cheap, and genuinely relevant for a geography-driven
  // catalog; the tour itself is filtered out below.
  const related = await getToursByRegion(tour.regionSlugs[0])
  return { tour, related: related.filter((t) => t.id !== tour.id).slice(0, 3) }
}

export function TourDetailPage() {
  const { tour, related } = useLoaderData() as { tour: Tour; related: readonly Tour[] }
  const regions = tour.regionSlugs.map((slug) => REGION_BY_SLUG[slug])

  return (
    <div>
      {/*
        Page-opening band (2.3), not a second hero: a low, full-bleed `panel`-tone strip carrying
        the veil wash, fading back into `--surface-page` at its own bottom edge (`.band-veil`).
        Breadcrumb, kind/badge row, H1 and the meta line all live inside it; gallery/body content
        below sits at the page's ordinary container width, since none of it is a large heading.
      */}
      <div className="band-veil relative w-full overflow-hidden pt-24 pb-18">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-16">
          <nav className="text-xs text-ink-muted">
            <Link to="/trips" className="transition-colors hover:text-gold-ink">
              Каталог
            </Link>
            <span className="mx-1.5">/</span>
            <span className="text-ink-dim">{tour.title}</span>
          </nav>

          <header className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <KindChip kind={tour.kind} />
              {tour.badges.map((badge) => (
                <BadgeChip key={badge.type} badge={badge} />
              ))}
            </div>

            <h1 className="text-gold-sheen h1-page mt-3">{tour.title}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-dim">
              <span className="flex items-center gap-1.5">
                <ClockIcon size={15} />
                {formatDuration(tour.durationDays, tour.durationNights)}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPinIcon size={15} />
                {regions.map((r) => r.ru).join(' · ')}
              </span>
              <span className="flex items-center gap-1.5 text-gold-ink">
                <StarIcon size={15} />
                {tour.rating.toFixed(1)}
                <span className="text-ink-muted">({formatReviewCount(tour.reviewCount)})</span>
              </span>
            </div>
          </header>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 pt-10 pb-8 sm:px-6 sm:pb-12">
        {/* Booking column is sticky on desktop so the CTA stays reachable while reading. */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <TourGallery images={tour.gallery} alt={tour.title} />

            <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-dim">
              {tour.shortDescription}
            </p>

            <section className="mt-10">
              <h2 className="font-display text-2xl text-ink">
                {tour.itinerary.length === 1 ? 'Программа дня' : 'Программа по дням'}
              </h2>
              <div className="mt-4">
                <TourItinerary days={tour.itinerary} />
              </div>
            </section>

            <section className="mt-10 grid gap-5 sm:grid-cols-2">
              <div className="rounded-2xl bg-panel p-5 ring-1 ring-edge">
                <h3 className="font-display text-lg text-ink">Включено</h3>
                <ul className="mt-3 space-y-2">
                  {tour.included.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-ink-dim">
                      <span className="mt-0.5 shrink-0 text-gold-ink">
                        <CheckIcon size={15} />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl bg-panel p-5 ring-1 ring-edge">
                <h3 className="font-display text-lg text-ink">Не включено</h3>
                <ul className="mt-3 space-y-2">
                  {tour.excluded.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-ink-muted">
                      <span className="mt-0.5 shrink-0 text-wine">
                        <CloseIcon size={15} />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <BookingCard tour={tour} />
          </aside>
        </div>

        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="font-display text-2xl text-ink">
              Ещё в {regions[0].ru}
              <span className="ml-2 align-middle text-sm text-ink-muted">
                {formatPrice(related[0].priceFrom, related[0].currency)} и выше
              </span>
            </h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {related.map((item) => (
                <TourCard key={item.id} tour={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
