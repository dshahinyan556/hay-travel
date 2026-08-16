import { motion } from 'framer-motion'
import type { Region } from '@/shared/data/armeniaRegions'
import { formatTourCount } from '@/shared/lib/format'
import { useReducedMotion } from '@/shared/hooks'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { ArrowRightIcon, CloseIcon } from '@/shared/ui/icons'

/**
 * `--dur-fast` / `--ease-out-soft` (`index.css`) in framer's units. The bar's original 220ms and
 * curve already matched the tokens exactly — 2.4 only names them, so the motion is unchanged and
 * a later change to the token no longer leaves this file behind.
 */
const DUR_FAST_S = 0.22
const EASE_OUT_SOFT: [number, number, number, number] = [0.22, 1, 0.36, 1]

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
 *
 * `bottom` clears the floating `MobileTabBar` (also fixed, same z-tier) rather than sitting flush
 * with the viewport edge — otherwise the two fixed layers stack and the tab bar paints over this
 * bar, hiding "Смотреть" entirely on compact viewports. `7rem` (not the tab bar's own ~5.4rem
 * top edge) leaves a visible gap between the two floating panels instead of them touching.
 */
export function RegionPreviewBar({ region, tourCount, onOpen, onDismiss }: RegionPreviewBarProps) {
  const reducedMotion = useReducedMotion()
  const { locale, t } = useLocale()
  // Reduced motion keeps the bar's appearance/disappearance — it just fades instead of rising.
  const travel = reducedMotion ? 0 : 16

  return (
    <motion.div
      initial={{ opacity: 0, y: travel }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: travel }}
      transition={{ duration: reducedMotion ? 0 : DUR_FAST_S, ease: EASE_OUT_SOFT }}
      role="group"
      aria-label={t('regions.previewBar.label')}
      style={{ bottom: 'calc(7rem + env(safe-area-inset-bottom))' }}
      className="fixed inset-x-3 z-30 flex items-center gap-3 rounded-2xl bg-panel/95 p-3 pl-4 shadow-2xl ring-1 ring-gold-line backdrop-blur-sm"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-xl leading-tight text-accent-strong">
          {locale === 'en' ? region.en : region.ru}
        </p>
        <p className="mt-0.5 text-xs text-ink-muted">{formatTourCount(tourCount, locale)}</p>
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="btn-motion btn-sheen inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-gold-fill px-4 py-2.5 text-sm font-medium text-gold-on hover:bg-gold-fill-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-page focus-visible:outline-none"
      >
        {t('regions.previewBar.open')}
        <ArrowRightIcon size={15} />
      </button>

      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('regions.previewBar.dismiss')}
        className="icon-press inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-muted hover:text-gold-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
      >
        <CloseIcon size={17} />
      </button>
    </motion.div>
  )
}
