import { useMemo } from 'react'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { formatAmountAmd } from './moneyFormat'
import { amdFromCurrency, amountInCurrency } from './pricing'
import type { CurrencyRate } from './types'
import { useCurrency } from './useCurrency'

export interface Money {
  /** The currency actually being RENDERED (`state.active`) — not necessarily the one selected, if
   * the selected one is not resolvable yet or at all. */
  currency: CurrencyRate
  /** AMD in → ready-to-render string. The only thing 95% of call sites need. */
  format(amountAmd: number): string
  /** AMD in → whole numeric amount in the display currency, for `<input value>` / sorting. Applies
   * NO rounding step, so it round-trips exactly with `toAmd` (see `pricing.amountInCurrency`). */
  amount(amountAmd: number): number
  /** Display-currency number → AMD, for fields the visitor types into (the catalog price filter). */
  toAmd(displayAmount: number): number
}

/**
 * The binding components actually call. Replaces the deleted `formatPrice()` from
 * `shared/lib/format.ts`, which printed a `$` over an AMD number (ADR 009, decision 3).
 *
 * The returned object is memoized on locale + active currency, so it is referentially stable
 * between real changes and safe to put in a dependency array.
 */
export function useMoney(): Money {
  const { locale } = useLocale()
  const { active } = useCurrency()

  return useMemo<Money>(
    () => ({
      currency: active,
      format: (amountAmd) => formatAmountAmd(amountAmd, active, locale),
      amount: (amountAmd) => amountInCurrency(amountAmd, active),
      toAmd: (displayAmount) => amdFromCurrency(displayAmount, active),
    }),
    [active, locale],
  )
}
