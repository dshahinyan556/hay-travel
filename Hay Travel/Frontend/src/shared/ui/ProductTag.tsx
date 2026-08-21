/**
 * `ProductTag` — a merch-tag pill on a product card ("Скидка 15%", "Хит сезона", …), up to 3 per
 * card, admin-managed (`features/admin/catalog/tags`). Same visual idiom as `KindChip` (rounded
 * pill, backdrop-blur, ring) — just re-colored per `Tag.color`, one of the site's own 5 palette
 * tokens (never a free hex), so a tag the admin invents tomorrow is guaranteed to read in both
 * themes without a manual contrast check.
 *
 * `TAG_COLOR_HEX` is exported for the admin color picker (`features/admin/catalog/tags`), which
 * runs in the admin's own light/neutral theme and therefore cannot lean on the `bg-*-soft`
 * utilities below — it needs the literal swatch value instead.
 */

import type { ReactNode } from 'react'

/** `TagColor` on the backend/admin (`features/admin/lib/enums.ts`) — repeated here as plain
 * numbers rather than imported, the same "own local copy of the wire constant" convention
 * `shared/api/tours.ts` uses for `TOUR_TYPE_EXCURSION` etc.: `shared/ui` sits below `features`,
 * so it cannot import the admin's enum module. */
const GOLD = 1
const WINE = 2
const SUCCESS = 3
const DANGER = 4
const WARNING = 5

const COLOR_CLASSES: Record<number, string> = {
  [GOLD]: 'bg-gold-soft text-gold-light ring-gold-line/70',
  [WINE]: 'bg-wine-tint/90 text-gold-light ring-wine/60',
  [SUCCESS]: 'bg-success-soft text-success ring-success/45',
  [DANGER]: 'bg-danger-soft text-danger ring-danger/45',
  [WARNING]: 'bg-warning-soft text-warning ring-warning/45',
}

/** Canonical dark-theme hex per `TagColor` — for the admin color picker
 * (`features/admin/catalog/tags`), which runs in the admin's own light/neutral theme and
 * therefore cannot lean on the `bg-*-soft` utilities above; it needs the literal swatch value. */
export const TAG_COLOR_HEX: Record<number, string> = {
  [GOLD]: '#d9b45a',
  [WINE]: '#8e1b38',
  [SUCCESS]: '#5fbf8a',
  [DANGER]: '#ef6a63',
  [WARNING]: '#e0a94a',
}

export function ProductTag({ color, children }: { color: number; children: ReactNode }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap backdrop-blur-sm ring-1',
        COLOR_CLASSES[color] ?? COLOR_CLASSES[GOLD],
      ].join(' ')}
    >
      {children}
    </span>
  )
}
