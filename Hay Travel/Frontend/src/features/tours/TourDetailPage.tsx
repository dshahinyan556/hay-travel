import { Link, useLoaderData, type LoaderFunctionArgs } from 'react-router'
import { getTourInfo, getToursByRegion } from '@/shared/api/tours'
import { getClosedDates } from '@/shared/api/booking'
import { getContentText, type ContentText } from '@/shared/api/siteSettings'
import { REGION_BY_SLUG } from '@/shared/data/armeniaRegions'
import type { Tour, TourDetail } from '@/shared/types/tour'
import { formatDuration } from '@/shared/lib/format'
import { useMoney } from '@/shared/currency'
import { getStoredLocale } from '@/shared/lib/locale'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { translate } from '@/shared/i18n/translate'
import { KindChip, Reveal, TourCard } from '@/shared/ui'
import { CheckIcon, ClockIcon, CloseIcon, MapPinIcon, TagIcon } from '@/shared/ui/icons'
import { TourGallery } from './components/TourGallery'
import { TourItinerary } from './components/TourItinerary'
import { getBookingWindow } from '@/shared/booking'
import { BookingCard } from './components/BookingCard'

export async function tourDetailLoader({ params }: LoaderFunctionArgs) {
  const tour = await getTourInfo(params.id!)
  if (!tour) {
    // Surfaces as the route error boundary rather than rendering an empty page.
    throw new Response(translate(getStoredLocale(), 'tourDetail.notFound'), { status: 404 })
  }
  // "Similar" = shares the first region. Cheap, and genuinely relevant for a geography-driven
  // catalog; the tour itself is filtered out below. A tour with no regions at all has nothing
  // to be "similar" by, so it skips the extra request entirely.
  //
  // `getContentText` rides along in the same `Promise.all` rather than serially: it never rejects
  // (same contract `ToursPage`/`HomePage` already rely on), so it cannot take this page down, and
  // it carries the 7+ invitation copy `BookingCard` needs.
  //
  // Closed dates ride along too, and are the loader's job rather than an effect in `BookingCard`
  // for the same reason `largeGroupInvitation` is: the card stays presentational w.r.t. the
  // network. `.catch(() => [])` is mandatory — availability must NEVER take the tour page down
  // (same contract as `getContentText`). Losing the list only means a visitor can pick a closed
  // day and get it rejected on submit (error code 2014, handled in the card).
  const window = getBookingWindow()
  const [related, content, closedDates] = await Promise.all([
    tour.regionSlugs[0] ? getToursByRegion(tour.regionSlugs[0]) : Promise.resolve<readonly Tour[]>([]),
    getContentText(),
    // The public `Tour.id` is a string; the backend wants a number. Converted here, once.
    getClosedDates(Number(tour.id), window.fromISO, window.toISO).catch(() => [] as string[]),
  ])
  return {
    tour,
    related: related.filter((t) => t.id !== tour.id).slice(0, 3),
    content,
    closedDates,
  }
}

export function TourDetailPage() {
  const { tour, related, content, closedDates } = useLoaderData() as {
    tour: TourDetail
    related: readonly Tour[]
    content: ContentText
    closedDates: readonly string[]
  }
  const regions = tour.regionSlugs.map((slug) => REGION_BY_SLUG[slug])
  const { locale, t } = useLocale()
  const money = useMoney()
  const regionName = (region: { ru: string; en: string }) => (locale === 'en' ? region.en : region.ru)

  return (
    <div>
      {/*
        Page-opening band (2.3), not a second hero: a low, full-bleed `panel`-tone strip carrying
        the veil wash, fading back into `--surface-page` at its own bottom edge (`.band-veil`).
        Breadcrumb, kind/badge row, H1 and the meta line all live inside it; gallery/body content
        below sits at the page's ordinary container width, since none of it is a large heading.
      */}
      <div className="band-veil relative w-full overflow-hidden pt-24 pb-18">
        {/* The band's background stays put; only its content rises (2.4). */}
        <Reveal as="div" className="mx-auto w-full max-w-7xl px-4 sm:px-16">
          <nav className="text-xs text-ink-muted">
            <Link to="/trips" className="link-underline hover:text-gold-ink">
              {t('tourDetail.breadcrumb')}
            </Link>
            <span className="mx-1.5">/</span>
            <span className="text-ink-dim">{tour.title}</span>
          </nav>

          <header className="mt-4">
            <KindChip kind={tour.kind} />

            <h1 className="text-gold-sheen h1-page mt-3">{tour.title}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-dim">
              <span className="flex items-center gap-1.5">
                <ClockIcon size={15} />
                {formatDuration(tour.durationDays, tour.durationNights, locale)}
              </span>
              {regions.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <MapPinIcon size={15} />
                  {regions.map(regionName).join(' · ')}
                </span>
              )}
            </div>
          </header>
        </Reveal>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 pt-10 pb-8 sm:px-6 sm:pb-12">
        {/* Booking column is sticky on desktop so the CTA stays reachable while reading. */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            {/* Gallery and lede rise together — one observer, one block. */}
            <Reveal as="div">
              <TourGallery images={tour.gallery} alt={tour.title} />

              <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-dim">
                {tour.shortDescription}
              </p>
            </Reveal>

            <section className="mt-10">
              {/*
                Only the heading is a `Reveal`: the days below are their own wave, owned by
                `TourItinerary`. Nesting a reveal group inside a revealed block would make the inner
                observer fire while its subject is still at `opacity: 0` — it intersects all the
                same — so the wave would play early, into an invisible list.
              */}
              <Reveal as="div">
                <h2 className="font-display text-2xl text-ink">
                  {tour.itinerary.length === 1 ? t('tourDetail.itineraryOneDay') : t('tourDetail.itineraryMultiDay')}
                </h2>
              </Reveal>
              <div className="mt-4">
                <TourItinerary days={tour.itinerary} />
              </div>
            </section>

            {/*
              Real backend data. `included`/`notIncluded` (2026-08) replace what used to be a pure
              frontend mock with two more `TourNoteType` values of the same `TourNote` entity as
              organizational details/restrictions — five independent lists, each its own block, so
              none is squeezed into a shape it doesn't fit. A block that has nothing to show
              renders nothing — including the section itself, if all five are empty for this tour.
            */}
            {(tour.included.length > 0 ||
              tour.notIncluded.length > 0 ||
              tour.organizationalDetails.length > 0 ||
              tour.restrictions.length > 0 ||
              tour.expenses.length > 0) && (
              <Reveal as="section" className="mt-10 grid gap-5 sm:grid-cols-2">
                {tour.included.length > 0 && (
                  <div className="rounded-2xl bg-panel p-5 ring-1 ring-edge">
                    <h3 className="font-semibold text-lg text-ink">{t('tourDetail.included')}</h3>
                    <ul className="mt-3 space-y-2">
                      {tour.included.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-ink-dim">
                          <span className="mt-0.5 shrink-0 text-accent-strong">
                            <CheckIcon size={15} />
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {tour.notIncluded.length > 0 && (
                  <div className="rounded-2xl bg-panel p-5 ring-1 ring-edge">
                    <h3 className="font-semibold text-lg text-ink">{t('tourDetail.notIncluded')}</h3>
                    <ul className="mt-3 space-y-2">
                      {tour.notIncluded.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-ink-muted">
                          <span className="mt-0.5 shrink-0 text-ink-muted">
                            <CloseIcon size={13} />
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {tour.organizationalDetails.length > 0 && (
                  <div className="rounded-2xl bg-panel p-5 ring-1 ring-edge">
                    <h3 className="font-semibold text-lg text-ink">{t('tourDetail.organizationalDetails')}</h3>
                    <ul className="mt-3 space-y-2">
                      {tour.organizationalDetails.map((item) => (
                        <li key={item} className="text-sm text-ink-dim">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {tour.restrictions.length > 0 && (
                  <div className="rounded-2xl bg-panel p-5 ring-1 ring-edge">
                    <h3 className="font-semibold text-lg text-ink">{t('tourDetail.restrictions')}</h3>
                    <ul className="mt-3 space-y-2">
                      {tour.restrictions.map((item) => (
                        <li key={item} className="text-sm text-ink-muted">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {tour.expenses.length > 0 && (
                  <div className="rounded-2xl bg-panel p-5 ring-1 ring-edge">
                    <h3 className="font-semibold text-lg text-ink">{t('tourDetail.expenses')}</h3>
                    <ul className="mt-3 space-y-2">
                      {tour.expenses.map((expense, index) => (
                        <li
                          key={`${expense.label}-${index}`}
                          className="flex items-start justify-between gap-2 text-sm text-ink-muted"
                        >
                          <span className="flex items-start gap-2">
                            <span className="mt-0.5 shrink-0 text-gold-ink">
                              <TagIcon size={15} />
                            </span>
                            {expense.label}
                          </span>
                          {/* AMD line items from the backend; converted through the same path as
                              every other price, but NOT tiered — an entrance fee does not scale
                              with group size. */}
                          {expense.amount !== null && (
                            <span className="shrink-0 text-ink-dim">{money.format(expense.amount)}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Reveal>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            {/*
              `rise={24}` — the heavier travel the spec reserves for the two big blocks (booking
              card, review panel), so the entrance stays proportional to the block's weight. The
              reveal sits INSIDE the sticky `<aside>`, not on it: a transform on the sticky element
              itself would drag its pinned position along for the duration of the transition.
            */}
            <Reveal rise={24}>
              {/* The local fallback is only used when the admin has not filled the setting in: a
                  blank value would leave the 7+ branch with an empty price area and no explanation
                  of why the price disappeared. Same reasoning as `fallbackHero()`. */}
              <BookingCard
                tour={tour}
                largeGroupInvitation={content.largeGroupInvitation || t('booking.largeGroupFallback')}
                closedDates={closedDates}
              />
            </Reveal>
          </aside>
        </div>

        {related.length > 0 && (
          <section className="mt-16">
            <Reveal as="div">
              <h2 className="font-display text-2xl text-ink">
                {t('tourDetail.moreIn', { region: regionName(regions[0]) })}
                <span className="ml-2 align-middle text-sm text-ink-muted">
                  {money.format(related[0].priceFrom)} {t('tourDetail.andUp')}
                </span>
              </h2>
            </Reveal>
            <Reveal group as="ul" className="mt-5 grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {/* `grid` on the wrapper: see the note in `FeaturedTours` — it keeps the card a
                  stretched grid item, so the aligned price line survives the reveal wrapper. */}
              {related.map((item) => (
                <li key={item.id} className="reveal-item grid">
                  <TourCard tour={item} />
                </li>
              ))}
            </Reveal>
          </section>
        )}
      </div>
    </div>
  )
}
