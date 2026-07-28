import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { ItineraryDay } from '@/shared/types/tour'
import { ChevronDownIcon, MapPinIcon } from '@/shared/ui/icons'

/**
 * Day-by-day itinerary as a vertical timeline with expandable days.
 *
 * The first day starts open so the section never reads as an empty list of headers. A single
 * day (an excursion) is rendered permanently open with no toggle — there is nothing to
 * collapse against, and a lone accordion header would be a pointless click.
 */
export function TourItinerary({ days }: { days: readonly ItineraryDay[] }) {
  const isSingleDay = days.length === 1
  const [openDay, setOpenDay] = useState<number | null>(days[0]?.day ?? null)

  return (
    <ol className="relative space-y-3">
      {days.map((day, index) => {
        const isOpen = isSingleDay || openDay === day.day
        const isLast = index === days.length - 1

        return (
          <li key={day.day} className="relative pl-11">
            {/* Timeline rail + node. The rail stops at the last node instead of running past it. */}
            {!isLast && (
              <span className="absolute top-9 left-[15px] h-[calc(100%+0.75rem)] w-px bg-edge" />
            )}
            <span className="absolute top-1 left-0 flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft font-display text-sm text-accent-strong ring-1 ring-wine/60">
              {day.day}
            </span>

            <div className="rounded-xl bg-panel ring-1 ring-edge">
              {isSingleDay ? (
                <div className="px-4 py-3">
                  <h3 className="font-display text-lg text-ink">{day.title}</h3>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setOpenDay(isOpen ? null : day.day)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
                >
                  <h3 className="font-display text-lg text-ink">{day.title}</h3>
                  <motion.span
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    className="ml-auto inline-flex text-gold-ink"
                  >
                    <ChevronDownIcon size={17} />
                  </motion.span>
                </button>
              )}

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-edge px-4 py-3">
                      <p className="text-sm leading-relaxed text-ink-dim">{day.description}</p>
                      <ul className="mt-3 flex flex-wrap gap-1.5">
                        {day.routePoints.map((point) => (
                          <li
                            key={point}
                            className="inline-flex items-center gap-1 rounded-full bg-panel-raised px-2.5 py-1 text-xs text-ink-dim ring-1 ring-edge"
                          >
                            <MapPinIcon size={12} />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
