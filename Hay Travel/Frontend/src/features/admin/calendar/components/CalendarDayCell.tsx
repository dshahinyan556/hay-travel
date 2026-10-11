import { useCopy } from '@/shared/i18n/defineCopy'
import { calendarCopy } from '../lib/calendarCopy'
import {
  closedScopesOf,
  closureLevelOf,
  tourTypePluralLabel,
  type CalendarGridDay,
} from '../lib/calendarModel'

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
  const copy = useCopy(calendarCopy)
  const level = closureLevelOf(day.day)
  const orders = day.day?.totalOrders ?? 0
  const guests = day.day?.ordersByTour.reduce((sum, row) => sum + row.guestCount, 0) ?? 0
  const { tourIds: closedTourIds, tourTypes: closedTourTypes } = closedScopesOf(day.day)

  const parts = [`${day.date.getDate()} ${copy.monthsGenitive[day.date.getMonth()]}`]
  if (orders > 0) parts.push(copy.ordersUnit(orders), copy.guestsUnit(guests))
  if (level === 'closed') {
    parts.push(copy.closedLabel)
  } else if (level === 'partial') {
    // Naming what is closed matters here: an indicator alone says "something is closed" without
    // saying what. Типы называются всегда (их максимум три), продукты — списком до двух,
    // дальше числом, чтобы подпись оставалась фразой, а не перечнем.
    if (closedTourTypes.length > 0) {
      parts.push(
        copy.closedTypesLabel(
          closedTourTypes.map((tourType) => tourTypePluralLabel(tourType, copy)).join(', '),
        ),
      )
    }
    if (closedTourIds.length > 0) {
      parts.push(
        closedTourIds.length <= 2
          ? `${copy.partialLabel}: ${closedTourIds.map(tourTitle).join(', ')}`
          : `${copy.partialLabel}: ${closedTourIds.length}`,
      )
    }
  }
  // Правки черновика: «будет закрыт / будет открыт» словами — цвет и пунктир для скринридера не
  // информация. Имена — как у частичного закрытия выше: до двух по названию, дальше числом.
  const draft = day.draft ?? null
  if (draft !== null) {
    const nameList = (names: string[]) => (names.length <= 2 ? names.join(', ') : String(names.length))
    if (draft.global === 'close') parts.push(copy.draftCellWillClose(copy.draftCellWholeDay))
    if (draft.global === 'open') parts.push(copy.draftCellWillOpen(copy.draftCellWholeDay))
    const closing = [
      ...draft.closeTypes.map((tourType) => tourTypePluralLabel(tourType, copy)),
      ...draft.closeTours.map(tourTitle),
    ]
    const opening = [
      ...draft.openTypes.map((tourType) => tourTypePluralLabel(tourType, copy)),
      ...draft.openTours.map(tourTitle),
    ]
    if (closing.length > 0) parts.push(copy.draftCellWillClose(nameList(closing)))
    if (opening.length > 0) parts.push(copy.draftCellWillOpen(nameList(opening)))
    if (draft.rulesTouched) parts.push(copy.draftCellTouched)
  }
  const description = parts.join(', ')

  const stateClasses = selected
    ? 'ring-2 ring-neutral-900'
    : level === 'closed'
      ? 'ring-1 ring-neutral-200'
      : 'ring-1 ring-neutral-200 hover:bg-neutral-50'
  // Синий пунктир по контуру — «в этом дне есть несохранённая правка»; закрытый черновиком день
  // получает ещё и синюю штриховку вместо серой, чтобы «будет закрыт» не читался как «закрыт».
  const draftClasses =
    draft === null ? '' : 'outline outline-1 -outline-offset-1 outline-dashed outline-blue-600'
  const hatchClasses =
    draft?.global === 'close'
      ? 'bg-blue-50 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgb(29_78_216/0.14)_5px,rgb(29_78_216/0.14)_10px)] text-blue-700'
      : 'bg-neutral-100 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgb(0_0_0/0.05)_5px,rgb(0_0_0/0.05)_10px)] text-neutral-400'

  return (
    <button
      type="button"
      onClick={() => onSelect(day.iso)}
      aria-label={description}
      aria-pressed={selected}
      aria-current={day.isToday ? 'date' : undefined}
      title={description}
      className={`relative flex aspect-square min-h-11 w-full min-w-0 cursor-pointer flex-col items-start justify-between overflow-hidden rounded-lg p-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30 ${stateClasses} ${draftClasses} ${
        level === 'closed'
          ? // Diagonal hatch as an arbitrary background-IMAGE (the `bg-neutral-100` next to it is
            // the background-COLOR, so the two compose rather than fight). Kept inline instead of
            // a global CSS class: one screen uses it.
            hatchClasses
          : day.isPast
            ? 'bg-white text-neutral-400'
            : 'bg-white text-neutral-900'
      } ${day.inMonth ? '' : 'opacity-40'}`}
    >
      <span
        className={`text-xs tabular-nums ${day.isToday ? 'font-bold text-neutral-900' : 'font-medium'}`}
      >
        {day.date.getDate()}
      </span>

      {/* "Closed" is already carried by the hatched background on the button itself — no glyph
          needed here too. "Partial" has no background of its own, so the dot is its only signal.
          Закрытие целого типа продукта (решение 0.27) рисуется тем же углом, но КОЛЬЦОМ: две
          разные вещи не должны выглядеть одинаково, а на слово в 55px-клетке места нет (бюджет
          содержимого клетки — B12). Что именно закрыто, читается из `aria-label`/`title`. */}
      {level === 'partial' && (
        <span
          aria-hidden="true"
          className={`absolute right-1 top-1 rounded-full ${
            closedTourTypes.length > 0
              ? 'h-2 w-2 border-[1.5px] border-neutral-900 bg-white'
              : 'h-1.5 w-1.5 bg-neutral-900'
          }`}
        />
      )}

      {orders > 0 && (
        <span className="max-w-full truncate rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-neutral-700">
          {orders}
        </span>
      )}
    </button>
  )
}
