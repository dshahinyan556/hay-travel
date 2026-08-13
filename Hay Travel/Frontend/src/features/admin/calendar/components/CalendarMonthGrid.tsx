import { weekdayLabels, weekdayOrder } from '../lib/calendarCopy'
import type { CalendarGridDay } from '../lib/calendarModel'
import { CalendarDayCell } from './CalendarDayCell'

export interface CalendarMonthGridProps {
  /** Exactly 42 cells from `buildCalendarGrid`. */
  days: CalendarGridDay[]
  selectedISO: string | null
  tourTitle: (tourId: number) => string
  onSelectDay: (iso: string) => void
  /** No data yet — draw the grey placeholder grid instead of interactive cells. */
  isSkeleton: boolean
}

/**
 * The month, as 42 Monday-first cells.
 *
 * Deliberately NOT an APG `role="grid"` with roving tabindex, unlike `DatePicker`: there is no
 * range selection or keyboard-driven date entry here, each cell just opens a detail panel. Plain
 * buttons in natural tab order are simpler and behave correctly with every screen reader without
 * the extra machinery.
 *
 * Widths: `grid-cols-7` with `gap-1` and `aspect-square` cells fits 360px without horizontal
 * scroll (7 × ~45px + 6 × 4px gaps) — the grid is never allowed to scroll sideways, only the rules
 * table is.
 *
 * `max-w-[440px] mx-auto`: below that width the grid is unconstrained (fills the phone screen,
 * `min-h-11` cells stay tappable); above it the cap keeps cells around 55–60px instead of growing
 * with a wide desktop container, so all 6 rows plus the toolbar/legend fit one screen without
 * scrolling (B12 redesign, 2026-08-13).
 */
export function CalendarMonthGrid({
  days,
  selectedISO,
  tourTitle,
  onSelectDay,
  isSkeleton,
}: CalendarMonthGridProps) {
  return (
    <div className="mx-auto w-full max-w-[440px]">
      {/* `aria-hidden`: each cell's own label already spells the weekday out, so announcing this
          header row would only add noise — same call `DatePicker` makes. */}
      <div
        aria-hidden="true"
        className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-neutral-400"
      >
        {weekdayOrder.map((code) => (
          <span key={code}>{weekdayLabels[code]}</span>
        ))}
      </div>

      <div className="mt-1.5 grid grid-cols-7 gap-1">
        {isSkeleton
          ? Array.from({ length: 42 }, (_, index) => (
              <div
                key={index}
                aria-hidden="true"
                className="aspect-square min-h-11 w-full animate-pulse rounded-lg bg-neutral-100"
              />
            ))
          : days.map((day) => (
              <CalendarDayCell
                key={day.iso}
                day={day}
                selected={day.iso === selectedISO}
                tourTitle={tourTitle}
                onSelect={onSelectDay}
              />
            ))}
      </div>
    </div>
  )
}
