import { motion } from 'framer-motion'
import type { Region } from '@/shared/data/armeniaRegions'
import { formatTourCount } from '@/shared/lib/format'
import { ArrowRightIcon, CloseIcon } from '@/shared/ui/icons'

interface RegionPreviewBarProps {
  region: Region
  tourCount: number
  /** Confirms the choice and opens the region panel. */
  onOpen: () => void
  /** Drops the highlight without opening anything. */
  onDismiss: () => void
}

/**
 * Touch-only confirmation step between tapping a region and opening its panel.
 *
 * On a phone the panel used to cover half the screen the instant a finger landed on the map,
 * with no way to tell which province was actually hit — hover, the desktop confirmation, does
 * not exist on touch. So the first tap only highlights the region and raises this bar; the panel
 * opens on "Смотреть" (or on a second tap on the same region).
 *
 * Anchored to the bottom of the viewport rather than placed under the map: it has to stay in the
 * thumb zone and stay visible wherever the map is scrolled to. Purely presentational — the
 * two-step state machine lives in `RegionExplorer`.
 */
export function RegionPreviewBar({ region, tourCount, onOpen, onDismiss }: RegionPreviewBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      role="group"
      aria-label="Выбранный регион"
      className="fixed inset-x-3 bottom-3 z-30 flex items-center gap-3 rounded-2xl bg-panel/95 p-3 pl-4 shadow-2xl ring-1 ring-gold-line backdrop-blur-sm"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-xl leading-tight text-accent-strong">{region.ru}</p>
        <p className="mt-0.5 text-xs text-ink-muted">{formatTourCount(tourCount)}</p>
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-gold-fill px-4 py-2.5 text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-page focus-visible:outline-none"
      >
        Смотреть
        <ArrowRightIcon size={15} />
      </button>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Снять выделение региона"
        className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-muted transition-colors hover:text-gold-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
      >
        <CloseIcon size={17} />
      </button>
    </motion.div>
  )
}
