/**
 * Pure data preparation for the availability calendar — no JSX, no network, no state.
 *
 * Everything here turns server payloads into exactly what the presentational components render,
 * so those components stay dumb and this file stays unit-testable.
 */

import { formatISODate, getMonthGrid, isSameDay, stripTime } from '@/shared/lib/date'
import { LanguageCode, TourTranslationType } from '@/features/admin/lib/enums'
import type { TourInfoModel } from '@/shared/types/attours'
import type { CalendarDayModel, CalendarMonthModel } from '@/shared/types/booking'

/** Cache/lookup key of a month: `YYYY-MM`. `month` is 1..12. */
export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

/** One cell of the month grid. */
export interface CalendarGridDay {
  date: Date
  iso: string
  /** Belongs to the displayed month — otherwise it is a neighbouring month's tail, dimmed. */
  inMonth: boolean
  isToday: boolean
  isPast: boolean
  /** The server's row for this day; `null` for tail cells outside the loaded month. */
  day: CalendarDayModel | null
}

/**
 * 42 Monday-first cells (`getMonthGrid` from `shared/lib/date` — the same grid `DatePicker`
 * draws), joined to the server's month payload by ISO date.
 *
 * @param month 1..12.
 * @param data  the loaded month, or `null` while it is still loading (every cell then carries
 *              `day: null`, which is what the skeleton renders).
 */
export function buildCalendarGrid(
  year: number,
  month: number,
  data: CalendarMonthModel | null,
  today: Date = new Date(),
): CalendarGridDay[] {
  const byIso = new Map<string, CalendarDayModel>()
  for (const day of data?.days ?? []) byIso.set(day.date, day)

  const todayStart = stripTime(today)
  // `month - 1`: the backend counts months from 1, `Date` from 0.
  return getMonthGrid(new Date(year, month - 1, 1)).map((date) => {
    const iso = formatISODate(date)
    return {
      date,
      iso,
      inMonth: date.getMonth() === month - 1 && date.getFullYear() === year,
      isToday: isSameDay(date, todayStart),
      isPast: date.getTime() < todayStart.getTime(),
      day: byIso.get(iso) ?? null,
    }
  })
}

/** How closed a day is, for the cell's indicator. */
export type DayClosureLevel = 'open' | 'partial' | 'closed'

export function closureLevelOf(day: CalendarDayModel | null): DayClosureLevel {
  if (day === null) return 'open'
  if (day.isClosedGlobally) return 'closed'
  if (day.closedTourIds.length > 0) return 'partial'
  return 'open'
}

/**
 * Tour title by id, for cells and lists.
 *
 * An unknown id falls back to `Тур #42` instead of blanking: a tour can be archived while its
 * orders live on, and a calendar that renders an empty name for those is a calendar that looks
 * broken.
 *
 * The Russian title is picked out of `translations` the same way `filterProducts`' private
 * `titleHaystack` does — the SELECTION is repeated, not the function: that one concatenates RU+EN
 * into one lowercase search string, which is not a title.
 */
export function tourTitleResolver(tours: TourInfoModel[]): (tourId: number) => string {
  const titles = new Map<number, string>()
  for (const tour of tours) {
    const title = tour.translations.find(
      (t) => t.type === TourTranslationType.Title && t.languageCode === LanguageCode.Russian,
    )?.value
    if (title) titles.set(tour.id, title)
  }
  return (tourId: number) => titles.get(tourId) ?? `Тур #${tourId}`
}
