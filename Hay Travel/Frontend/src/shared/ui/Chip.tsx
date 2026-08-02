/**
 * `KindChip` — small labelled pill answering "is this a tour or a one-day excursion?", a domain
 * fact always shown on tour cards and detail pages.
 *
 * Colour encodes the kind consistently across the whole site: wine + moon = tour (has an
 * overnight stay), gold + sun = excursion (single day). See `docs/client-site.md`.
 */

import type { TourKind } from '@/shared/types/tour'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { MoonIcon, SunIcon } from './icons'

export function KindChip({ kind }: { kind: TourKind }) {
  const { t } = useLocale()
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
      {isTour ? t('chip.tour') : t('chip.excursion')}
    </span>
  )
}
