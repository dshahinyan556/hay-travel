/**
 * Public surface of the currency vertical. Features and `shared/ui` import from
 * `@/shared/currency`, never from a file inside it — same discipline as `shared/auth/index.ts`.
 *
 * NOT exported on purpose: `currencyApi` (the store is its only legitimate caller).
 *
 * `features/admin/**` must never import this module: the admin edits the stored AMD value and has
 * to show it raw, un-converted and un-rounded (ADR 009).
 */

export type { CurrencyCode, CurrencyRate, CurrencyState, ExchangeRatesModel, RatesStatus } from './types'

export {
  ensureRatesReady,
  getCurrencyState,
  refreshRatesIfStale,
  setCurrency,
  subscribeCurrency,
} from './currencyStore'

export {
  TIER_BASE_MAX_GUESTS,
  TIER_SURCHARGE_MAX_GUESTS,
  TIER_SURCHARGE_MULTIPLIER,
  amdFromCurrency,
  amountInCurrency,
  applyGroupTier,
  convertFromAmd,
  priceInCurrency,
  resolveTier,
  roundToStep,
} from './pricing'
export type { PriceTier, TieredPrice } from './pricing'

export { formatAmountAmd, formatMoney } from './moneyFormat'

export { useCurrency } from './useCurrency'
export { useMoney } from './useMoney'
export type { Money } from './useMoney'
