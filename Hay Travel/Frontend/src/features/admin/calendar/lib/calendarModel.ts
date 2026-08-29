/**
 * Pure data preparation for the availability calendar — no JSX, no network, no state.
 *
 * Everything here turns server payloads into exactly what the presentational components render,
 * so those components stay dumb and this file stays unit-testable.
 */

import { formatISODate, getMonthGrid, isSameDay, stripTime } from '@/shared/lib/date'
import type { Locale } from '@/shared/lib/locale'
import { LanguageCode, TourTranslationType, TourType } from '@/features/admin/lib/enums'
import type { TourInfoModel } from '@/shared/types/attours'
import type { CalendarCopy } from './calendarCopy'
import {
  ClosureRuleType,
  OrderStatus,
  type CalendarDayModel,
  type CalendarMonthModel,
  type ClosureRuleInfoModel,
  type OrderInfoModel,
} from '@/shared/types/booking'

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

/**
 * How closed a day is, for the cell's indicator.
 *
 * `partial` covers BOTH narrower scopes a rule can have (решение 0.27): отдельные продукты
 * (`closedTourIds`) и целые типы продукта (`closedTourTypes`). Различает их не уровень, а
 * `closedScopesOf` ниже — уровень отвечает только за фон клетки.
 */
export type DayClosureLevel = 'open' | 'partial' | 'closed'

export function closureLevelOf(day: CalendarDayModel | null): DayClosureLevel {
  if (day === null) return 'open'
  if (day.isClosedGlobally) return 'closed'
  if (day.closedTourIds.length > 0 || (day.closedTourTypes ?? []).length > 0) return 'partial'
  return 'open'
}

/** Что именно закрыто в этот день, когда день не закрыт целиком. Пустые списки у открытого дня. */
export interface DayClosedScopes {
  tourIds: number[]
  /** `TourType` (1/2/3). `?? []` — месяц, отданный бэком до появления поля, не должен ронять
   * клетку на `undefined.length`. */
  tourTypes: number[]
}

export function closedScopesOf(day: CalendarDayModel | null): DayClosedScopes {
  return {
    tourIds: day?.closedTourIds ?? [],
    tourTypes: day?.closedTourTypes ?? [],
  }
}

/** Порядок типов в чипах и в подписях — тот же, что у enum'а, а не порядок прихода с сервера. */
export const TOUR_TYPE_ORDER: TourType[] = [TourType.Tour, TourType.Excursion, TourType.Transfer]

/** «Трансферы» — для чипа выбора. Неизвестный тип (бэк добавил четвёртый раньше фронта) даёт
 * номер, а не пустую подпись. */
export function tourTypePluralLabel(tourType: number, copy: CalendarCopy): string {
  return copy.productTypePlural[tourType as TourType] ?? copy.productTypeFallback(tourType)
}

/** «Все трансферы» — для колонки «Область» и подписи клетки. */
export function tourTypeScopeLabel(tourType: number, copy: CalendarCopy): string {
  return copy.productTypeScope[tourType as TourType] ?? copy.productTypeFallback(tourType)
}

/**
 * Tour title by id, for cells and lists.
 *
 * Follows the INTERFACE locale with a fallback to Russian (ADR 021, decision 5): the content itself
 * is not translated here — the tour already carries both languages — but an English panel in which
 * every tour is captioned in Russian reads like a half-finished translation. A tour with no title
 * in the current locale keeps its Russian one rather than blanking.
 *
 * An unknown id falls back to `Тур #42` instead of blanking too: a tour can be archived while its
 * orders live on, and a calendar that renders an empty name for those is a calendar that looks
 * broken.
 *
 * The title is picked out of `translations` the same way `filterProducts`' private `titleHaystack`
 * does — the SELECTION is repeated, not the function: that one concatenates RU+EN into one
 * lowercase search string, which is not a title.
 */
export function tourTitleResolver(
  tours: TourInfoModel[],
  locale: Locale,
  copy: CalendarCopy,
): (tourId: number) => string {
  const preferred = locale === 'en' ? LanguageCode.English : LanguageCode.Russian
  const titles = new Map<number, string>()
  for (const tour of tours) {
    const titleOf = (languageCode: LanguageCode): string | null | undefined =>
      tour.translations.find(
        (t) => t.type === TourTranslationType.Title && t.languageCode === languageCode,
      )?.value
    const title = titleOf(preferred) || titleOf(LanguageCode.Russian)
    if (title) titles.set(tour.id, title)
  }
  return (tourId: number) => titles.get(tourId) ?? copy.tourFallback(tourId)
}

/**
 * One `OrderLine` paired with its parent order's header fields — what the calendar's day panel
 * actually renders (ADR 019: `Order` is multi-line, but a day cell/panel is about lines that fall
 * on THAT day, which can belong to different tours/dates even within one order).
 */
export interface CalendarOrderLine {
  orderId: number
  orderNumber: string
  status: OrderStatus
  userEmail: string
  userFullName: string
  /** ISO-8601 UTC instant — the ORDER's creation time, not the line's (a line has none of its own). */
  createdAtUtc: string
  tourId: number
  /** `YYYY-MM-DD`. */
  tourDate: string
  guestCount: number
}

/**
 * Flattens orders into their lines, dropping Rejected orders (`OrderCalendarInfo`'s own occupancy
 * rule — everything counts as "occupying" the calendar except Rejected, checklist-orders-redesign
 * Фаза 1.8). Order-level fields (status/number/client) are on `Order`, not `OrderLine`, so they
 * are copied onto every line of that order.
 */
export function flattenOrderLines(orders: OrderInfoModel[]): CalendarOrderLine[] {
  return orders
    .filter((order) => order.status !== OrderStatus.Rejected)
    .flatMap((order) =>
      order.lines.flatMap((line) =>
        // Строка без продукта (заявка кастомного трансфера, батч 2026-08-29) в этот экран не
        // попадает: календарь и занятость строятся ВОКРУГ тура — и группировка дня, и правила
        // закрытия адресуются `tourId`. Отдельная задача про закрытие трансферов решит, чем такая
        // строка занимает день; до неё честнее её не показывать, чем показать без принадлежности.
        line.tourId === null
          ? []
          : [
              {
                orderId: order.id,
                orderNumber: order.number,
                status: order.status,
                userEmail: order.userEmail,
                userFullName: order.userFullName,
                createdAtUtc: order.createdAtUtc,
                tourId: line.tourId,
                tourDate: line.tourDate,
                guestCount: line.guestCount,
              },
            ],
      ),
    )
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
  locale: Locale,
): number {
  // От самой широкой области к самой узкой: глобально → тип продукта → один продукт
  // (решение 0.27 добавило среднюю ступень).
  const rankOf = (rule: ClosureRuleInfoModel): number =>
    rule.tourId !== null ? 2 : rule.tourType !== null ? 1 : 0
  if (rankOf(a) !== rankOf(b)) return rankOf(a) - rankOf(b)
  if (a.tourType !== null && b.tourType !== null && a.tourType !== b.tourType) {
    return a.tourType - b.tourType
  }
  if (a.tourId !== null && b.tourId !== null && a.tourId !== b.tourId) {
    return tourTitle(a.tourId).localeCompare(tourTitle(b.tourId), locale)
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
  locale: Locale,
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

  for (const group of groups) group.rules.sort((a, b) => compareClosureRules(a, b, tourTitle, locale))
  groups.sort((a, b) => compareClosureRules(a.rules[0], b.rules[0], tourTitle, locale))
  return groups
}
