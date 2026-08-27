/**
 * Pure data prep for the Заказы list — filtering and small per-order aggregates. No JSX, no
 * network.
 */

import { LanguageCode, TourTranslationType } from '@/features/admin/lib/enums'
import { LANGUAGE_CODE_BY_LOCALE, type Locale } from '@/shared/lib/locale'
import type { TourInfoModel } from '@/shared/types/attours'
import type { OrderInfoModel } from '@/shared/types/booking'
import type { OrdersCopy } from './ordersCopy'

/** Same shape as `calendar/lib/calendarModel.ts`'s `tourTitleResolver` — kept as a small,
 * deliberate duplication rather than a cross-feature import: a feature does not reach into another
 * feature's `lib`, and this is the only other call site.
 *
 * The title follows the INTERFACE language (ADR 021, решение 5) and falls back to the Russian one
 * when a tour has no translation in it — the content itself is not translated here, an existing
 * string is picked. `locale`/`copy` are parameters because this is a pure module (Spec 009 §3). */
export function tourTitleResolver(
  tours: TourInfoModel[],
  locale: Locale,
  copy: OrdersCopy,
): (tourId: number) => string {
  const preferred = LANGUAGE_CODE_BY_LOCALE[locale]
  const titles = new Map<number, string>()
  for (const tour of tours) {
    const candidates = tour.translations.filter((t) => t.type === TourTranslationType.Title)
    const title =
      candidates.find((t) => t.languageCode === preferred)?.value?.trim() ||
      candidates.find((t) => t.languageCode === LanguageCode.Russian)?.value?.trim()
    if (title) titles.set(tour.id, title)
  }
  return (tourId: number) => titles.get(tourId) ?? copy.tourFallback(tourId)
}

export interface OrderFiltersState {
  tourId: number | null
  client: string
  /** Matched as a substring of `Order.number` (e.g. "160826" finds every order created that day). */
  numberQuery: string
  /** `YYYY-MM-DD` or `''`. Compared lexicographically against each line's `tourDate` — safe for
   * ISO dates, no `Date` parsing needed. */
  dateFrom: string
  dateTo: string
}

export const emptyOrderFilters: OrderFiltersState = {
  tourId: null,
  client: '',
  numberQuery: '',
  dateFrom: '',
  dateTo: '',
}

export function hasActiveFilters(filters: OrderFiltersState): boolean {
  return (
    filters.tourId !== null ||
    filters.client.trim() !== '' ||
    filters.numberQuery.trim() !== '' ||
    filters.dateFrom !== '' ||
    filters.dateTo !== ''
  )
}

/** An order matches when AT LEAST ONE line satisfies the tour/date filters — same predicate shape
 * as the server's own `GetAllAsync` (`order.Lines.Any(...)`, ADR 019). */
export function matchesOrderFilters(order: OrderInfoModel, filters: OrderFiltersState): boolean {
  const numberQuery = filters.numberQuery.trim().toLowerCase()
  if (numberQuery !== '' && !order.number.toLowerCase().includes(numberQuery)) return false

  const client = filters.client.trim().toLowerCase()
  if (client !== '') {
    const haystack = `${order.userFullName} ${order.userEmail}`.toLowerCase()
    if (!haystack.includes(client)) return false
  }

  if (filters.tourId === null && filters.dateFrom === '' && filters.dateTo === '') return true

  return order.lines.some((line) => {
    if (filters.tourId !== null && line.tourId !== filters.tourId) return false
    if (filters.dateFrom !== '' && line.tourDate < filters.dateFrom) return false
    if (filters.dateTo !== '' && line.tourDate > filters.dateTo) return false
    return true
  })
}

/** First line's tour title, plus a "+N" suffix for every additional line — what the list row and
 * calendar-adjacent screens show as the order's headline (a multi-line order otherwise has no
 * single "the" tour). `tourTitle` is the same resolver `OrderFilters`' dropdown uses. */
export function orderHeadline(order: OrderInfoModel, copy: OrdersCopy): string {
  const first = order.lines[0]
  if (!first) return ''
  const title = first.tourTitle ?? copy.tourFallback(first.tourId)
  return order.lines.length > 1 ? `${title} +${order.lines.length - 1}` : title
}

/** Earliest line date — what the list sorts/displays a single order by. */
export function orderEarliestDate(order: OrderInfoModel): string {
  return order.lines.reduce((min, line) => (min === '' || line.tourDate < min ? line.tourDate : min), '')
}

export function orderTotalGuests(order: OrderInfoModel): number {
  return order.lines.reduce((sum, line) => sum + line.guestCount, 0)
}
