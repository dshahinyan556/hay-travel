/**
 * Money → string. PURE presentation: no store, no React, no conversion policy beyond what
 * `pricing.ts` already decided.
 */

import type { Locale } from '@/shared/lib/locale'
import { priceInCurrency } from './pricing'
import type { CurrencyRate } from './types'

/**
 * Codes whose symbol goes AFTER the number, with a non-breaking space (`112 000 ֏`, `24 500 ₽`).
 * Everything else is prefixed (`$290`, `€270`, and a future `£240`).
 *
 * This is the one currency-specific thing the frontend legitimately owns: it is a TYPOGRAPHIC
 * convention, not a pricing rule, so the backend has no business shipping it. An unknown new code
 * lands on the prefix default and renders correctly with no frontend change.
 */
const SUFFIX_SYMBOL_CODES = new Set(['AMD', 'RUB'])

/** Non-breaking space — the amount and its symbol must never break across lines. */
const NBSP = ' '

/**
 * Format an amount that is ALREADY in `rate`'s currency.
 *
 * `Intl.NumberFormat` for the digit grouping only — deliberately not `style: 'currency'`, which
 * would force decimals, pick its own symbol and its own placement, none of which match this design.
 */
export function formatMoney(amount: number, rate: CurrencyRate, locale: Locale): string {
  const digits = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ru-RU', {
    maximumFractionDigits: 0,
  }).format(amount)
  return SUFFIX_SYMBOL_CODES.has(rate.code) ? `${digits}${NBSP}${rate.symbol}` : `${rate.symbol}${digits}`
}

/** Convert + round + format: the whole AMD → display string pipeline in one call. */
export function formatAmountAmd(amountAmd: number, rate: CurrencyRate, locale: Locale): string {
  return formatMoney(priceInCurrency(amountAmd, rate), rate, locale)
}
