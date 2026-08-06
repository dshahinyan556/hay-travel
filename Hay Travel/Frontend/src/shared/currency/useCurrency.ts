import { useSyncExternalStore } from 'react'
import { getCurrencyState, subscribeCurrency } from './currencyStore'
import type { CurrencyState } from './types'

/**
 * The whole currency snapshot. Only `CurrencySwitch` needs this — everything that just renders a
 * price uses `useMoney()` instead.
 *
 * `useSyncExternalStore` subscribes during render, so a component can never paint a snapshot that
 * was already stale when it mounted. `getCurrencyState` doubles as the server snapshot: this app is
 * client-rendered only, and the seeded initial state is the honest answer for a first paint anyway.
 */
export function useCurrency(): CurrencyState {
  return useSyncExternalStore(subscribeCurrency, getCurrencyState, getCurrencyState)
}
