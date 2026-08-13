import { calendarCopy, guestsUnit, monthLabelsGenitive, ordersUnit } from '../lib/calendarCopy'
import { closureLevelOf, type CalendarGridDay } from '../lib/calendarModel'

export interface CalendarDayCellProps {
  day: CalendarGridDay
  selected: boolean
  tourTitle: (tourId: number) => string
  onSelect: (iso: string) => void
}

/**
 * One day of the month grid — a plain `<button>` (see `CalendarMonthGrid` for why this grid is not
 * an APG `role="grid"`).
 *
 * Content budget: with the grid capped at 440px (`CalendarMonthGrid`) a cell is ~55–60px at every
 * screen size, not just the narrowest one, so it holds AT MOST two things — the date number and
 * one indicator — everywhere, not just on phones. Tour names never appear inside a cell; they
 * live in the day panel, which is what a cell click opens. A closed day is carried by the hatched
 * background + muted text alone (no extra ✕ glyph on top of it — one signal, not three); "partial"
 * has no background treatment of its own, so it keeps the amber dot to stay distinguishable.
 * Everything the colours/pattern/dot say is repeated as words in `aria-label`/`title`, since none
 * of that is information for a screen reader (or for a colour-blind admin).
 */
export function CalendarDayCell({ day, selected, tourTitle, onSelect }: CalendarDayCellProps) {
  const level = closureLevelOf(day.day)
  const orders = day.day?.totalOrders ?? 0
  const guests = day.day?.ordersByTour.reduce((sum, row) => sum + row.guestCount, 0) ?? 0
  const closedTourIds = day.day?.closedTourIds ?? []

  const parts = [`${day.date.getDate()} ${monthLabelsGenitive[day.date.getMonth()]}`]
  if (orders > 0) parts.push(ordersUnit(orders), guestsUnit(guests))
  if (level === 'closed') {
    parts.push(calendarCopy.closedLabel)
  } else if (level === 'partial') {
    // Naming the tours matters here: the amber dot alone says "something is closed" without
    // saying what. Capped so the label stays a sentence, not a list.
    parts.push(
      closedTourIds.length <= 2
        ? `${calendarCopy.partialLabel}: ${closedTourIds.map(tourTitle).join(', ')}`
        : `${calendarCopy.partialLabel}: ${closedTourIds.length}`,
    )
  }
  const description = parts.join(', ')

  const stateClasses = selected
    ? 'ring-2 ring-brand-600'
    : level === 'closed'
      ? 'ring-1 ring-neutral-200'
      : 'ring-1 ring-neutral-200 hover:bg-neutral-50'

  return (
    <button
      type="button"
      onClick={() => onSelect(day.iso)}
      aria-label={description}
      aria-pressed={selected}
      aria-current={day.isToday ? 'date' : undefined}
      title={description}
      className={`relative flex aspect-square min-h-11 w-full min-w-0 cursor-pointer flex-col items-start justify-between overflow-hidden rounded-lg p-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 ${stateClasses} ${
        level === 'closed'
          ? // Diagonal hatch as an arbitrary background-IMAGE (the `bg-neutral-100` next to it is
            // the background-COLOR, so the two compose rather than fight). Kept inline instead of
            // a global CSS class: one screen uses it.
            'bg-neutral-100 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgb(0_0_0/0.05)_5px,rgb(0_0_0/0.05)_10px)] text-neutral-400'
          : day.isPast
            ? 'bg-white text-neutral-400'
            : 'bg-white text-neutral-900'
      } ${day.inMonth ? '' : 'opacity-40'}`}
    >
      <span
        className={`text-xs tabular-nums ${day.isToday ? 'font-bold text-brand-700' : 'font-medium'}`}
      >
        {day.date.getDate()}
      </span>

      {/* "Closed" is already carried by the hatched background on the button itself — no glyph
          needed here too. "Partial" has no background of its own, so the dot is its only signal. */}
      {level === 'partial' && (
        <span
          aria-hidden="true"
          className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-500"
        />
      )}

      {orders > 0 && (
        <span className="max-w-full truncate rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-brand-700">
          {orders}
        </span>
      )}
    </button>
  )
}
