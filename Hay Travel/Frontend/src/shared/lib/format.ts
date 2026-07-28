import type { Tour } from '@/shared/types/tour'

/** Russian plural forms: [1, 2–4, 5+] — e.g. `['день', 'дня', 'дней']`. */
function pluralizeRu(count: number, [one, few, many]: [string, string, string]): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}

/**
 * `3 дня · 2 ночи` for a tour, `1 день` for an excursion.
 *
 * An excursion has no overnight stay, so the nights half is dropped entirely rather than
 * spelled out as "без ночёвки" — the kind is already signalled by the sun/moon chip.
 */
export function formatDuration(days: number, nights: number): string {
  const daysLabel = pluralizeRu(days, ['день', 'дня', 'дней'])
  if (nights <= 0) return `${days} ${daysLabel}`
  const nightsLabel = pluralizeRu(nights, ['ночь', 'ночи', 'ночей'])
  return `${days} ${daysLabel} · ${nights} ${nightsLabel}`
}

/** Bare amount, e.g. `$290`. The "цена от" caption is rendered separately by the card. */
export function formatPrice(price: number, currency: Tour['currency']): string {
  const symbol = currency === 'USD' ? '$' : '֏'
  return `${symbol}${price.toLocaleString('ru-RU')}`
}

export function formatReviewCount(count: number): string {
  return `${count} ${pluralizeRu(count, ['отзыв', 'отзыва', 'отзывов'])}`
}

/** `12 туров` / `1 тур` — used by the map tooltip and the region panel counter. */
export function formatTourCount(count: number): string {
  return `${count} ${pluralizeRu(count, ['тур', 'тура', 'туров'])}`
}
