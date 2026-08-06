/**
 * The ONLY module that knows the exchange-rate endpoint exists.
 *
 * Anonymous endpoint (the currency switcher is available signed in or out), so `apiFetch` — not
 * `authFetch`. No `languageCode` param: nothing in the payload is translatable (sync-doc §5).
 */

import { apiFetch } from '@/shared/lib/http'
import type { ExchangeRatesModel } from './types'

/**
 * Throws `ApiError`, including the 503 `ExchangeRatesUnavailable` cold start (no rate has ever been
 * stored). The store is the only caller and owns the degrade decision — unlike
 * `shared/api/siteSettings.ts` this module does NOT swallow errors, because "no rates" and "empty
 * rates" are genuinely different outcomes here.
 */
export function fetchExchangeRates(): Promise<ExchangeRatesModel> {
  return apiFetch<ExchangeRatesModel>('api/ExchangeRate/GetCurrent')
}
