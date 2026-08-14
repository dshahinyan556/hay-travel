/**
 * Pure data preparation for the availability calendar — no JSX, no network, no state.
 *
 * Everything here turns server payloads into exactly what the presentational components render,
 * so those components stay dumb and this file stays unit-testable.
 */

import { formatISODate, getMonthGrid, isSameDay, stripTime } from '@/shared/lib/date'
import { LanguageCode, TourTranslationType } from '@/features/admin/lib/enums'
import type { TourInfoModel } from '@/shared/types/attours'
import { ClosureRuleType, type CalendarDayModel, type CalendarMonthModel, type ClosureRuleInfoModel } from '@/shared/types/booking'

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

/**
 * Ordering for the «Блокировки» table: global rules first, then by tour name; within the same
 * scope, by type (date rules before weekly) and then by date/weekday. Exported so it can order
 * both individual rules (inside a group) and groups themselves (by their first rule).
 */
export function compareClosureRules(
  a: ClosureRuleInfoModel,
  b: ClosureRuleInfoModel,
  tourTitle: (tourId: number) => string,
): number {
  if ((a.tourId === null) !== (b.tourId === null)) return a.tourId === null ? -1 : 1
  if (a.tourId !== null && b.tourId !== null && a.tourId !== b.tourId) {
    return tourTitle(a.tourId).localeCompare(tourTitle(b.tourId), 'ru')
  }
  if (a.type !== b.type) return a.type === ClosureRuleType.SpecificDate ? -1 : 1
  if (a.type === ClosureRuleType.SpecificDate) return (a.date ?? '').localeCompare(b.date ?? '')
  return (a.dayOfWeek ?? 0) - (b.dayOfWeek ?? 0)
}

export interface ClosureRuleGroup {
  /** The real `BatchId` for a batch of 2+, or a synthetic `rule-${id}` key for a standalone rule
   * (no batch, or a batch of exactly one) — every group gets a stable React key even though only
   * some of them are an actual "group" the table renders as expandable. */
  key: string
  rules: ClosureRuleInfoModel[]
}

/**
 * Buckets rules by `batchId` — every rule created by the same `CreateRules` call (one bulk
 * operation, or a single toggle) lands in one group. A `null` batchId (data from before this
 * column existed) always gets its own singleton group, never merged with anything.
 *
 * `action`/`type`/`reason` are NOT re-checked for being the same across a group: both creation
 * paths (`BulkClosurePanel`, `DayClosureControls`) submit one action/type/reason per `CreateRules`
 * call and only vary `tourId`/`date`/`dayOfWeek` across the list, so a batch is guaranteed
 * homogeneous in those three columns by construction — the table's group-summary row relies on
 * this and reads them off the first rule rather than re-deriving them.
 */
export function groupClosureRules(
  rules: ClosureRuleInfoModel[],
  tourTitle: (tourId: number) => string,
): ClosureRuleGroup[] {
  const byBatch = new Map<string, ClosureRuleGroup>()
  const groups: ClosureRuleGroup[] = []

  for (const rule of rules) {
    if (rule.batchId === null) {
      groups.push({ key: `rule-${rule.id}`, rules: [rule] })
      continue
    }
    const existing = byBatch.get(rule.batchId)
    if (existing) {
      existing.rules.push(rule)
    } else {
      const group: ClosureRuleGroup = { key: rule.batchId, rules: [rule] }
      byBatch.set(rule.batchId, group)
      groups.push(group)
    }
  }

  for (const group of groups) group.rules.sort((a, b) => compareClosureRules(a, b, tourTitle))
  groups.sort((a, b) => compareClosureRules(a.rules[0], b.rules[0], tourTitle))
  return groups
}
