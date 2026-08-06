/**
 * Wire + state types for the currency vertical.
 *
 * Contract source: `docs/currency-pricing-sync.md` §5 (`GET /api/ExchangeRate/GetCurrent`).
 */

/**
 * NOT a union of 'AMD'|'USD'|'EUR'|'RUB'.
 *
 * The backend catalog (sync-doc §2) promises "adding GBP later = one catalog entry, one DB row,
 * zero frontend changes". A literal union would break that promise on the first new currency —
 * every unknown code would fail to type-check its way into the switcher.
 */
export type CurrencyCode = string

/**
 * One row of `rates[]`.
 *
 * Wire shape and UI shape are deliberately the same object: there is nothing to map, and a second
 * identical interface would only be one more thing to keep in sync.
 */
export interface CurrencyRate {
  code: CurrencyCode
  /** A glyph (`֏ $ € ₽`), identical in every locale — never translated. */
  symbol: string
  /** AMD per exactly 1 unit of `code`. AMD's own row is exactly 1. */
  ratePerUnitAmd: number
  /** 100 | 1 | 1 | 100 — comes from the backend catalog, NEVER hardcoded per currency here. */
  roundingStep: number
}

/** Response body of `GET /api/ExchangeRate/GetCurrent`. */
export interface ExchangeRatesModel {
  baseCurrency: CurrencyCode
  lastUpdatedUtc: string
  rateDateUtc: string
  isStale: boolean
  rates: CurrencyRate[]
}

export type RatesStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface CurrencyState {
  /** What the visitor picked (localStorage). May not be resolvable yet, or ever (503 cold start). */
  selectedCode: CurrencyCode
  /**
   * The currency actually renderable RIGHT NOW: `selectedCode`'s rate if present in `rates`,
   * otherwise the AMD row. Never null — this is what removes every `if (!rates)` branch from every
   * price call site in the app.
   */
  active: CurrencyRate
  /** Everything the switcher offers, in backend order (AMD first). Never empty. */
  rates: readonly CurrencyRate[]
  status: RatesStatus
  /**
   * The backend's own freshness flag, passed straight through. Deliberately not rendered anywhere
   * (see `moneyFormat.ts`) — carried so a badge would be a one-component change if it is ever asked
   * for.
   */
  isStale: boolean
  /** Epoch ms of the last SUCCESSFUL fetch; 0 if never. */
  lastFetchedAt: number
}
