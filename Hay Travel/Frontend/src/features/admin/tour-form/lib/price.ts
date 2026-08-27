/**
 * The header's price is never entered directly — it is always the sum of each day's price
 * (an Excursion has exactly one day, so its "sum" is just that one price). Kept separate from
 * `validation.ts` since it derives a display value, not a blocking error.
 */

import type { Locale } from '@/shared/lib/locale'
import type { TourDayFormState } from '@/features/admin/types/form'

/** Digit grouping follows the interface language — `15 000` in Russian, `15,000` in English.
 * Built once per locale rather than per render: `Intl.NumberFormat` construction is the
 * expensive half of formatting. */
const PRICE_FORMAT: Record<Locale, Intl.NumberFormat> = {
  ru: new Intl.NumberFormat('ru-RU'),
  en: new Intl.NumberFormat('en-GB'),
}

/** Sum of every day's price; a day with an empty or non-numeric price contributes 0. */
export function computeTotalPrice(days: TourDayFormState[]): number {
  return days.reduce((sum, day) => {
    const n = Number(day.price.trim().replace(',', '.'))
    return sum + (Number.isFinite(n) ? n : 0)
  }, 0)
}

export function formatTotalPrice(total: number, locale: Locale): string {
  return `${PRICE_FORMAT[locale].format(total)} ֏`
}

/**
 * A single day's raw price string as a compact summary label, e.g. "15 000 ֏" or "0 ֏" — what a
 * collapsed `TourDayCard` shows. Unlike `formatTotalPrice` it starts from what the admin typed,
 * so anything unparseable is echoed back verbatim instead of silently becoming 0.
 */
export function formatDayPrice(raw: string, locale: Locale): string {
  const trimmed = raw.trim()
  if (trimmed === '') return '0 ֏'
  const n = Number(trimmed.replace(',', '.'))
  return `${Number.isFinite(n) ? PRICE_FORMAT[locale].format(n) : trimmed} ֏`
}
