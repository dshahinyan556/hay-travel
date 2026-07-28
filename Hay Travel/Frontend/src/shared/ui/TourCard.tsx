import { Link } from 'react-router'
import { motion } from 'framer-motion'
import type { Tour } from '@/shared/types/tour'
import { REGION_BY_SLUG } from '@/shared/data/armeniaRegions'
import { formatDuration, formatPrice } from '@/shared/lib/format'
import { BadgeChip, KindChip } from './Chip'
import { ClockIcon, HeartIcon, MapPinIcon } from './icons'

/**
 * Tour card for the showcase, catalog and region panel.
 *
 * ── Alignment (explicit client requirement) ───────────────────────────────────────────────
 * In the first version the price "floated": a card with a one-line title pulled its footer up,
 * so prices in a row sat at different heights. Fixed structurally, not with magic numbers:
 *
 *   1. `h-full` + a `flex flex-col` body makes every card fill its grid cell, so all cards in
 *      a row share one height (CSS grid stretches them by default).
 *   2. The footer (duration + price) gets `mt-auto`, pinning it to the bottom — the price line
 *      is therefore at the SAME height on every card regardless of title length.
 *   3. Titles and descriptions are clamped (`line-clamp-2`), so long copy ends in an ellipsis
 *      instead of pushing the layout around.
 *
 * A fixed title height would have been the other option, but it wastes vertical space on short
 * titles and still breaks at narrow widths — clamping plus `mt-auto` holds at any breakpoint.
 *
 * ── Interaction ───────────────────────────────────────────────────────────────────────────
 * Not a "click to expand" card: hovering slides a route summary up over the image, so the
 * itinerary can be judged without leaving the page. It is presentational only — everything it
 * reveals is also on the detail page, so keyboard and touch users lose nothing (they never get
 * `:hover`). The whole card is one link, so there is a single tab stop per card.
 */
export function TourCard({ tour }: { tour: Tour }) {
  const regions = tour.regionSlugs.map((slug) => REGION_BY_SLUG[slug].ru)
  // First-day stops stand in for the route teaser — enough to convey the shape of the trip.
  const routeTeaser = tour.itinerary[0]?.routePoints ?? []

  return (
    <motion.article
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className="group h-full"
    >
      <Link
        to={`/tours/${tour.slug}`}
        className="relative flex h-full flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-panel-raised to-panel ring-1 ring-edge transition-shadow duration-300 hover:ring-gold-line focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
      >
        {/*
          Top blink (2.3): a short hairline at rest, stretching to the card's full width on
          hover/focus. `scale-x` from a centred origin rather than animating `width`, so the
          browser only ever transforms a compositor layer — `duration-[var(--dur-fast)]` ties it
          to the token that collapses to 1ms under `prefers-reduced-motion` (see `index.css`).
        */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 z-10 h-px origin-center scale-x-[0.14] bg-gold-line transition-transform duration-[var(--dur-fast)] ease-out group-hover:scale-x-100 group-focus-within:scale-x-100"
        />

        {/* Cover */}
        <div className="relative aspect-[4/3] shrink-0 overflow-hidden">
          <img
            src={tour.coverImage}
            alt={tour.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          {/* Scrim keeps chip text legible over any photo. */}
          <div className="absolute inset-0 bg-gradient-to-t from-obsidian/85 via-obsidian/10 to-obsidian/40" />

          <div className="absolute inset-x-3 top-3 flex flex-wrap items-start gap-1.5">
            {tour.badges.map((badge) => (
              <BadgeChip key={badge.type} badge={badge} />
            ))}
            {/* Sits on an obsidian pill over the photo, so it keeps the literal cream tint
                rather than the theme-aware ink token, which would go dark in light mode. */}
            <span className="ml-auto rounded-full bg-obsidian/70 p-1.5 text-cream-dim ring-1 ring-edge transition-colors group-hover:text-gold-light">
              <HeartIcon size={15} />
            </span>
          </div>

          <div className="absolute bottom-3 left-3">
            <KindChip kind={tour.kind} />
          </div>

          {/* Hover-revealed route teaser. `translate-y-full` parks it just below the frame. */}
          {routeTeaser.length > 0 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-obsidian/92 px-4 py-3 backdrop-blur-sm transition-transform duration-300 ease-out group-hover:translate-y-0">
              <p className="text-[11px] tracking-[0.14em] text-gold uppercase">Маршрут</p>
              {/* Also on an obsidian scrim — literal cream, not the theme token. */}
              <p className="mt-1 line-clamp-2 text-sm text-cream-dim">
                {routeTeaser.join(' → ')}
              </p>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col p-4">
          <p className="flex items-center gap-1.5 text-[11px] tracking-[0.14em] text-gold-ink uppercase">
            <MapPinIcon size={13} />
            <span className="truncate">{regions.join(' · ')}</span>
          </p>

          <h3 className="card-title mt-2 line-clamp-2 text-ink">{tour.title}</h3>

          <p className="mt-1.5 line-clamp-2 text-sm text-ink-muted">{tour.shortDescription}</p>

          {/* `mt-auto` is what puts every card's price on the same line. */}
          <div className="mt-auto flex items-end justify-between gap-3 border-t border-edge pt-3.5">
            <span className="flex items-center gap-1.5 text-xs text-ink-dim">
              <ClockIcon size={14} />
              {formatDuration(tour.durationDays, tour.durationNights)}
            </span>
            <span className="text-right leading-tight">
              <span className="block text-[10px] tracking-wide text-ink-muted">цена от</span>
              <span className="font-display text-2xl text-gold-ink">
                {formatPrice(tour.priceFrom, tour.currency)}
              </span>
            </span>
          </div>
        </div>
      </Link>
    </motion.article>
  )
}

/**
 * Loading placeholder for a `TourCard` grid (2.3). Mirrors the real card's structure exactly —
 * same cover aspect ratio, same body padding, same footer split — so a grid of these never jumps
 * when the real cards land. Shimmer comes from `.skeleton-shimmer` (`--gold-soft`, ~1.8s, see
 * `index.css`), which already disables itself under `prefers-reduced-motion`.
 *
 * `aria-hidden`: this stands in for content, not content itself — screen readers should skip it
 * rather than read out a row of empty bars. Whatever announces the loading state (e.g. an
 * `aria-live` region on the grid) does that job instead.
 */
export function TourCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex h-full flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-panel-raised to-panel ring-1 ring-edge"
    >
      <div className="skeleton-shimmer aspect-[4/3] shrink-0 bg-edge/30" />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="skeleton-shimmer h-3 w-2/5 rounded-full bg-edge/30" />
        <div className="skeleton-shimmer h-5 w-4/5 rounded-full bg-edge/30" />
        <div className="skeleton-shimmer h-3 w-full rounded-full bg-edge/30" />
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-edge pt-3.5">
          <div className="skeleton-shimmer h-3 w-14 rounded-full bg-edge/30" />
          <div className="skeleton-shimmer h-6 w-20 rounded-full bg-edge/30" />
        </div>
      </div>
    </div>
  )
}
