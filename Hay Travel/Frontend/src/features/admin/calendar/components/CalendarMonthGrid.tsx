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
 * `max-w-[440px] mx-auto`: below `lg` the grid is unconstrained (fills the phone/tablet screen,
 * `min-h-11` cells stay tappable), which pins the cell at ~59px on any screen ≥440px wide — that
 * exact size is the thing to preserve above `lg`, not grow (2026-08-14, corrected same day: the
 * first cut let `1fr` columns track the wider outer `max-w`, which grew the cells — and since
 * they are `aspect-square`, grew the whole grid TALLER too, which was never asked for). Fixed
 * instead: the day-grid/header-row keep the same ~59px column via an explicit pixel `width`
 * (`lg:w-[516px] xl:w-[564px]`, `mx-auto` to sit centered in the now-wider outer cap) — only the
 * GAP between cells grows (`gap-1` → `lg:gap-4` → `xl:gap-6`), which is where the extra
 * horizontal room actually goes. Row height is untouched at any breakpoint.
 */
export function CalendarMonthGrid({
  days,
  selectedISO,
  tourTitle,
  onSelectDay,
  isSkeleton,
}: CalendarMonthGridProps) {
  return (
    <div className="mx-auto w-full max-w-[440px] lg:max-w-[720px] xl:max-w-[960px]">
      {/* `aria-hidden`: each cell's own label already spells the weekday out, so announcing this
          header row would only add noise — same call `DatePicker` makes. */}
      <div
        aria-hidden="true"
        className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-neutral-400 lg:mx-auto lg:w-[516px] lg:gap-4 xl:w-[564px] xl:gap-6"
      >
        {weekdayOrder.map((code) => (
          <span key={code}>{weekdayLabels[code]}</span>
        ))}
      </div>

      <div className="mt-1.5 grid grid-cols-7 gap-1 lg:mx-auto lg:mt-2 lg:w-[516px] lg:gap-4 xl:w-[564px] xl:gap-6">
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
