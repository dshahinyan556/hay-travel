import { Link } from 'react-router'
import type { Tour } from '@/shared/types/tour'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { Reveal, TourCard } from '@/shared/ui'
import { ArrowRightIcon } from '@/shared/ui/icons'

/**
 * Home-page showcase.
 *
 * `items-stretch` (the grid default) plus `h-full` inside `TourCard` is what keeps every card
 * in a row the same height — the mechanism behind the aligned price line. Do not add
 * `items-start` here: it would collapse cards to their content height and the prices would
 * drift apart again, which is the exact bug the client reported. The `<li>` wrappers added for
 * the 2.4 wave are stretched grid items themselves, so the card's `h-full` still resolves against
 * the row height and the alignment is unchanged.
 */
export function FeaturedTours({ tours, heading }: { tours: readonly Tour[]; heading: string }) {
  const { t } = useLocale()

  // Nothing marked featured yet (admin hasn't picked any in `Продукты → Избранные`) — no filler
  // section, per David's explicit instruction (2026-08-02): no "first N tours" fallback.
  if (tours.length === 0) return null

  return (
    // First section after the hero: `pt-24 pb-32` per the 2.3 rhythm (hero → section), not the
    // ordinary `py-20 sm:py-28` other sections use.
    <section className="mx-auto w-full max-w-7xl px-4 pt-24 pb-32 sm:px-16">
      <Reveal as="div" className="flex flex-wrap items-end justify-between gap-4">
        {/* Single-line heading — the small "ИЗБРАННОЕ" eyebrow above it was removed (2026-08-02),
            the heading text now comes from the admin (`Настройки → Тексты сайта`). */}
        <h2 className="text-gold-sheen h2-section">{heading}</h2>
        <Link
          to="/trips"
          className="link-underline inline-flex items-center gap-1.5 text-sm text-gold-ink hover:text-accent-strong"
        >
          {t('home.featured.allCatalog')}
          <ArrowRightIcon size={15} />
        </Link>
      </Reveal>

      {/*
        The cards come in as a wave (2.4): the `<ul>` is the reveal group, each `<li>` an item, and
        `--i` comes from `:nth-child` — no index prop needed. The list markup is also the honest
        one for three sibling cards; Tailwind's preflight strips the default bullet and padding, so
        nothing about the grid changes.

        The `<li>` exists because `.reveal-item` and the card's own `.card-lift` both declare
        `transform` and must not share an element. `grid` on it keeps the price line aligned: the
        card is then a stretched grid item exactly as it was before the wrapper appeared, so its
        `h-full` resolves against a real row height instead of an inherited percentage.
      */}
      <Reveal
        group
        as="ul"
        className="mt-10 grid gap-5 sm:mt-14 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
      >
        {tours.map((tour) => (
          <li key={tour.id} className="reveal-item grid min-w-0">
            <TourCard tour={tour} />
          </li>
        ))}
      </Reveal>
    </section>
  )
}
