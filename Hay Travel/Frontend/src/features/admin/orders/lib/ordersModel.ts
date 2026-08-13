/**
 * Pure data prep for the Заказы list — filtering and the tour-title lookup. No JSX, no network.
 */

import { LanguageCode, TourTranslationType } from '@/features/admin/lib/enums'
import type { TourInfoModel } from '@/shared/types/attours'
import type { OrderInfoModel } from '@/shared/types/booking'

/** Same shape and same RU-title rule as `calendar/lib/calendarModel.ts`'s `tourTitleResolver` —
 * kept as a small, deliberate duplication rather than a cross-feature import: a feature does not
 * reach into another feature's `lib` (see `shared/types/booking.ts`'s own note on this), and this
 * is the only other call site. */
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

export interface OrderFiltersState {
  tourId: number | null
  client: string
  idQuery: string
  /** `YYYY-MM-DD` or `''`. Compared lexicographically against `order.tourDate` — safe for ISO
   * dates, no `Date` parsing needed. */
  dateFrom: string
  dateTo: string
}

export const emptyOrderFilters: OrderFiltersState = {
  tourId: null,
  client: '',
  idQuery: '',
  dateFrom: '',
  dateTo: '',
}

export function hasActiveFilters(filters: OrderFiltersState): boolean {
  return (
    filters.tourId !== null ||
    filters.client.trim() !== '' ||
    filters.idQuery.trim() !== '' ||
    filters.dateFrom !== '' ||
    filters.dateTo !== ''
  )
}

export function matchesOrderFilters(order: OrderInfoModel, filters: OrderFiltersState): boolean {
  if (filters.tourId !== null && order.tourId !== filters.tourId) return false

  const idQuery = filters.idQuery.trim()
  if (idQuery !== '' && !String(order.id).includes(idQuery)) return false

  const client = filters.client.trim().toLowerCase()
  if (client !== '') {
    const haystack = `${order.userFullName} ${order.userEmail}`.toLowerCase()
    if (!haystack.includes(client)) return false
  }

  if (filters.dateFrom !== '' && order.tourDate < filters.dateFrom) return false
  if (filters.dateTo !== '' && order.tourDate > filters.dateTo) return false

  return true
}
