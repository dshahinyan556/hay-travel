import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { ItineraryDay } from '@/shared/types/tour'
import { useReducedMotion } from '@/shared/hooks'
import { Reveal } from '@/shared/ui'
import { ChevronDownIcon, MapPinIcon } from '@/shared/ui/icons'

/**
 * `--dur-base` / `--ease-out-soft` (`index.css`), in the seconds-and-array form framer takes.
 *
 * A height animation cannot be expressed as a CSS token here — `AnimatePresence` needs the number
 * in JS — so these mirror the tokens and MUST stay in step with them. `prefers-reduced-motion` is
 * therefore an explicit gate below rather than something the token block handles for free.
 */
const DUR_BASE_S = 0.34
const EASE_OUT_SOFT: [number, number, number, number] = [0.22, 1, 0.36, 1]

/**
 * Day-by-day itinerary as a vertical timeline with expandable days.
 *
 * The first day starts open so the section never reads as an empty list of headers. A single
 * day (an excursion) is rendered permanently open with no toggle — there is nothing to
 * collapse against, and a lone accordion header would be a pointless click.
 *
 * The list owns its own scroll reveal (2.4): the days come in as a wave, so the caller renders the
 * section heading and leaves this to us rather than wrapping the whole thing in one `Reveal`.
 */
export function TourItinerary({ days }: { days: readonly ItineraryDay[] }) {
  const isSingleDay = days.length === 1
  const [openDay, setOpenDay] = useState<number | null>(days[0]?.day ?? null)
  const reducedMotion = useReducedMotion()

  return (
    <Reveal group as="ol" className="relative space-y-3">
      {days.map((day, index) => {
        const isOpen = isSingleDay || openDay === day.day
        const isLast = index === days.length - 1

        return (
          <li key={day.day} className={['reveal-item relative', !isSingleDay && 'pl-11'].filter(Boolean).join(' ')}>
            {/*
              Timeline rail + numbered node — only meaningful when there is more than one day to
              tell apart. A single-day itinerary (an excursion) has nothing to number against, so
              neither the rail nor the "1" badge renders; the card sits flush left instead.
            */}
            {!isSingleDay && (
              <>
                {!isLast && (
                  <span className="absolute top-9 left-[15px] h-[calc(100%+0.75rem)] w-px bg-edge" />
                )}
                <span className="absolute top-1 left-0 flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft font-display text-sm text-accent-strong ring-1 ring-wine/60">
                  {day.day}
                </span>
              </>
            )}

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
                  {/* Explicit transition, not framer's default spring: the chevron turns on the
                      same token pair as the panel it controls, and stops turning entirely under
                      reduced motion (the state still changes, it just doesn't travel). */}
                  <motion.span
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{
                      duration: reducedMotion ? 0 : DUR_BASE_S,
                      ease: EASE_OUT_SOFT,
                    }}
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
                    transition={{
                      duration: reducedMotion ? 0 : DUR_BASE_S,
                      ease: EASE_OUT_SOFT,
                    }}
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
    </Reveal>
  )
}
