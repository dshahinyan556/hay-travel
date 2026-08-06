import { Link } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import type { Region } from '@/shared/data/armeniaRegions'
import type { Tour } from '@/shared/types/tour'
import { formatDuration, formatTourCount } from '@/shared/lib/format'
import { useMoney } from '@/shared/currency'
import { useReducedMotion } from '@/shared/hooks'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { KindChip } from '@/shared/ui/Chip'
import {
  ArrowRightIcon,
  CloseIcon,
  CompassIcon,
  ClockIcon,
  AlertIcon,
} from '@/shared/ui/icons'

/**
 * The wave the rest of the site runs on, in framer's units: `--stagger` (70ms) between rows,
 * `--dur-base` / `--ease-out-soft` for each. The list is rendered by `AnimatePresence`, so the
 * numbers cannot be CSS tokens here — they mirror `index.css` and must stay in step with it.
 *
 * `STAGGER_CAP` matches the `:nth-child` cap in the CSS group: past the 9th row the delay stops
 * growing, so a region with 20 tours does not end on a second and a half of dead time.
 */
const STAGGER_S = 0.07
const STAGGER_CAP = 8
const DUR_BASE_S = 0.34
const EASE_OUT_SOFT: [number, number, number, number] = [0.22, 1, 0.36, 1]

export type RegionPanelState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; tours: readonly Tour[] }

interface RegionPanelProps {
  region: Region
  state: RegionPanelState
  onClose: () => void
  onRetry: () => void
}

/**
 * Tours for the selected region.
 *
 * One component serves both layouts: on `lg+` it is a column beside the map, on mobile the
 * parent renders it inside a bottom sheet. Keeping it layout-agnostic (no fixed positioning
 * of its own) is what allows that without duplicating the list markup.
 *
 * All four states are handled explicitly — loading, error, empty and ready. Empty is a real
 * case, not an edge case: several regions have no products yet, and that has to look
 * intentional rather than broken.
 */
export function RegionPanel({ region, state, onClose, onRetry }: RegionPanelProps) {
  const reducedMotion = useReducedMotion()
  const { locale, t } = useLocale()
  const regionName = locale === 'en' ? region.en : region.ru
  const regionBlurb = locale === 'en' ? region.blurbEn : region.blurb

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/*
        `touch-none`: inside the bottom sheet the header doubles as a drag surface, and the
        browser must not claim the vertical swipe that starts on it. Harmless in the desktop
        column, where nothing is draggable anyway.
      */}
      <header className="flex touch-none items-start gap-3 border-b border-edge pb-3">
        <div className="min-w-0">
          <p className="text-[11px] tracking-[0.16em] text-gold-ink uppercase">{t('regions.panel.label')}</p>
          <h3 className="font-display text-2xl leading-tight text-accent-strong">{regionName}</h3>
          <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{regionBlurb}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('regions.panel.close')}
          // `.icon-press` = colour + the 90ms press, and it replaces `transition-colors` rather
          // than joining it (unlayered CSS outranks the utility — see `index.css`).
          className="icon-press ml-auto inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-muted hover:text-gold-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
        >
          <CloseIcon size={18} />
        </button>
      </header>

      {/*
        `data-sheet-scroll` marks this as the scrollable area: the bottom sheet reads it to know
        that a gesture starting here belongs to the list, not to the sheet, so a scrolled list is
        never fighting the drag. `overscroll-contain` stops the scroll from chaining out of it.
      */}
      <div data-sheet-scroll className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {state.status === 'loading' && <PanelSkeleton />}

        {state.status === 'error' && (
          <PanelMessage
            tone="error"
            icon={<AlertIcon size={26} />}
            title={t('regions.panel.errorTitle')}
            body={t('regions.panel.errorBody')}
            action={
              <button
                type="button"
                onClick={onRetry}
                className="btn-motion cursor-pointer rounded-full px-4 py-2 text-sm text-gold-ink ring-1 ring-gold-line hover:bg-accent-soft"
              >
                {t('regions.panel.retry')}
              </button>
            }
          />
        )}

        {state.status === 'ready' && state.tours.length === 0 && (
          <PanelMessage
            icon={<CompassIcon size={26} />}
            title={t('regions.panel.emptyTitle')}
            body={t('regions.panel.emptyBody', { region: regionName })}
            action={
              <Link
                to="/trips"
                className="btn-motion inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm text-gold-ink ring-1 ring-gold-line hover:bg-accent-soft"
              >
                {t('regions.panel.allCatalog')}
                <ArrowRightIcon size={15} />
              </Link>
            }
          />
        )}

        {state.status === 'ready' && state.tours.length > 0 && (
          <>
            <p className="text-xs text-ink-muted">{formatTourCount(state.tours.length, locale)}</p>
            <ul className="mt-3 space-y-2.5">
              <AnimatePresence initial={false}>
                {state.tours.map((tour, index) => (
                  <motion.li
                    key={tour.id}
                    initial={{ opacity: 0, y: reducedMotion ? 0 : 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: reducedMotion ? 0 : DUR_BASE_S,
                      delay: reducedMotion ? 0 : Math.min(index, STAGGER_CAP) * STAGGER_S,
                      ease: EASE_OUT_SOFT,
                    }}
                  >
                    <RegionTourRow tour={tour} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Compact tour row. A thumbnail-plus-text row rather than a full `TourCard`: the panel is a
 * narrow column, where full cards would force one item per screen.
 */
function RegionTourRow({ tour }: { tour: Tour }) {
  const { locale } = useLocale()
  const money = useMoney()

  return (
    <Link
      to={`/tours/${tour.id}`}
      className="group flex gap-3 rounded-xl bg-panel-raised p-2.5 ring-1 ring-edge transition-colors hover:ring-gold-line focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
    >
      <img
        src={tour.coverImage}
        alt=""
        loading="lazy"
        className="h-20 w-20 shrink-0 rounded-lg object-cover"
      />
      {/* `min-w-0` lets the clamped text actually shrink inside the flex row. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-2">
          <h4 className="line-clamp-2 font-display text-base leading-snug text-ink">
            {tour.title}
          </h4>
          <span className="ml-auto shrink-0">
            <KindChip kind={tour.kind} />
          </span>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="flex items-center gap-1.5 text-[11px] text-ink-muted">
            <ClockIcon size={13} />
            {formatDuration(tour.durationDays, tour.durationNights, locale)}
          </span>
          <span className="font-display text-lg text-gold-ink">
            {money.format(tour.priceFrom)}
          </span>
        </div>
      </div>
    </Link>
  )
}

function PanelSkeleton() {
  return (
    <ul className="space-y-2.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex gap-3 rounded-xl bg-panel-raised p-2.5 ring-1 ring-edge">
          <div className="h-20 w-20 shrink-0 animate-pulse rounded-lg bg-edge/60" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-3.5 w-4/5 animate-pulse rounded bg-edge/60" />
            <div className="h-3 w-2/5 animate-pulse rounded bg-edge/40" />
          </div>
        </li>
      ))}
    </ul>
  )
}

/**
 * Empty and error share one visual language (2.3): dashed border + the veil wash. Only the
 * icon's colour tells them apart — `error` gets the danger accent, `empty` stays on the ordinary
 * gold-ink, so a merely-empty region doesn't read as broken.
 */
function PanelMessage({
  icon,
  title,
  body,
  action,
  tone = 'empty',
}: {
  icon: React.ReactNode
  title: string
  body: string
  action: React.ReactNode
  tone?: 'empty' | 'error'
}) {
  return (
    <div className="veil-top flex flex-col items-center rounded-2xl border border-dashed border-edge px-4 py-10 text-center">
      <span className={tone === 'error' ? 'text-danger' : 'text-gold-ink'}>{icon}</span>
      <p className="mt-3 font-display text-lg text-ink">{title}</p>
      <p className="mt-1.5 max-w-xs text-sm text-ink-muted">{body}</p>
      <div className="mt-4">{action}</div>
    </div>
  )
}
