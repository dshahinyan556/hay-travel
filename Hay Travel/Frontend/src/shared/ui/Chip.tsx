/**
 * Small labelled pills used on tour cards and detail pages.
 *
 * Two distinct jobs, deliberately split into two components rather than one `variant` soup:
 *  - `KindChip` answers "is this a tour or a one-day excursion?" — a domain fact, always shown.
 *  - `BadgeChip` carries marketing signals (popular / discount / last seats / guided), which
 *    are optional and can appear several at a time.
 *
 * Colour encodes the kind consistently across the whole site: wine + moon = tour (has an
 * overnight stay), gold + sun = excursion (single day). See `docs/client-site.md`.
 */

import type { TourBadge, TourBadgeType, TourKind } from '@/shared/types/tour'
import { GuideIcon, MoonIcon, StarIcon, SunIcon, TagIcon } from './icons'

const KIND_LABEL: Record<TourKind, string> = {
  tour: 'Тур',
  excursion: 'Экскурсия',
}

export function KindChip({ kind }: { kind: TourKind }) {
  const isTour = kind === 'tour'
  const Glyph = isTour ? MoonIcon : SunIcon
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur-sm',
        isTour
          ? 'bg-wine-tint/90 text-gold-light ring-1 ring-wine/60'
          : 'bg-obsidian/70 text-gold ring-1 ring-gold-deep/50',
      ].join(' ')}
    >
      <Glyph size={13} />
      {KIND_LABEL[kind]}
    </span>
  )
}

const BADGE_ICON: Record<TourBadgeType, typeof StarIcon> = {
  popular: StarIcon,
  discount: TagIcon,
  lastSeats: StarIcon,
  guide: GuideIcon,
}

/**
 * `discount` is the only badge that gets the wine fill — it is the one signal worth
 * shouting. The rest stay on a muted gold tint so a card with three badges still reads
 * calmly instead of turning into a christmas tree.
 */
const BADGE_STYLE: Record<TourBadgeType, string> = {
  popular: 'bg-obsidian/75 text-gold-light ring-1 ring-gold-deep/40',
  discount: 'bg-wine text-gold-light ring-1 ring-gold-light/30',
  lastSeats: 'bg-obsidian/75 text-gold-light ring-1 ring-gold-deep/40',
  guide: 'bg-obsidian/75 text-cream-dim ring-1 ring-edge',
}

export function BadgeChip({ badge }: { badge: TourBadge }) {
  const Glyph = BADGE_ICON[badge.type]
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur-sm',
        BADGE_STYLE[badge.type],
      ].join(' ')}
    >
      <Glyph size={12} />
      {badge.label}
    </span>
  )
}
