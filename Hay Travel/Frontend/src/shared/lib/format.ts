import type { Locale } from '@/shared/lib/locale'

/** Russian plural forms: [1, 2–4, 5+] — e.g. `['день', 'дня', 'дней']`. */
function pluralizeRu(count: number, [one, few, many]: [string, string, string]): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}

/** English plural forms: [singular, plural] — count === 1 is the only singular case. */
function pluralizeEn(count: number, [one, many]: [string, string]): string {
  return count === 1 ? one : many
}

/**
 * `3 дня · 2 ночи` for a tour, `1 день` for an excursion.
 *
 * An excursion has no overnight stay, so the nights half is dropped entirely rather than
 * spelled out as "без ночёвки"/"no overnight stay" — the kind is already signalled by the
 * sun/moon chip.
 */
export function formatDuration(days: number, nights: number, locale: Locale = 'ru'): string {
  if (locale === 'en') {
    const daysLabel = pluralizeEn(days, ['day', 'days'])
    if (nights <= 0) return `${days} ${daysLabel}`
    const nightsLabel = pluralizeEn(nights, ['night', 'nights'])
    return `${days} ${daysLabel} · ${nights} ${nightsLabel}`
  }
  const daysLabel = pluralizeRu(days, ['день', 'дня', 'дней'])
  if (nights <= 0) return `${days} ${daysLabel}`
  const nightsLabel = pluralizeRu(nights, ['ночь', 'ночи', 'ночей'])
  return `${days} ${daysLabel} · ${nights} ${nightsLabel}`
}

/** Bare amount, e.g. `$290`. The "цена от"/"from" caption is rendered separately by the card.
 * USD only: the backend has no currency concept, and every product priced through the admin is
 * USD in practice — nothing to branch on. */
export function formatPrice(price: number, locale: Locale = 'ru'): string {
  return `$${price.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')}`
}

/** `12 туров`/`12 tours`, `1 тур`/`1 tour` — used by the map tooltip and the region panel counter. */
export function formatTourCount(count: number, locale: Locale = 'ru'): string {
  if (locale === 'en') return `${count} ${pluralizeEn(count, ['tour', 'tours'])}`
  return `${count} ${pluralizeRu(count, ['тур', 'тура', 'туров'])}`
}
