/**
 * The header's price is never entered directly — it is always the sum of each day's price
 * (an Excursion has exactly one day, so its "sum" is just that one price). Kept separate from
 * `validation.ts` since it derives a display value, not a blocking error.
 */

import type { TourDayFormState } from '@/features/admin/types/form'

const priceFormatter = new Intl.NumberFormat('ru-RU')

/** Sum of every day's price; a day with an empty or non-numeric price contributes 0. */
export function computeTotalPrice(days: TourDayFormState[]): number {
  return days.reduce((sum, day) => {
    const n = Number(day.price.trim().replace(',', '.'))
    return sum + (Number.isFinite(n) ? n : 0)
  }, 0)
}

export function formatTotalPrice(total: number): string {
  return `${priceFormatter.format(total)} ֏`
}
