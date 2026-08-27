import { useSyncExternalStore } from 'react'
import { getCartState, subscribeCart } from './cartStore'
import type { CartState } from './types'

/**
 * The whole cart snapshot — for `/cart`, which renders and edits every position.
 *
 * `useSyncExternalStore` subscribes during render, so a component can never paint a snapshot that
 * was already stale when it mounted. `getCartState` doubles as the server snapshot: this app is
 * client-rendered only.
 */
export function useCart(): CartState {
  return useSyncExternalStore(subscribeCart, getCartState, getCartState)
}

/** Only the position count — for the header badge, which must not re-render on a guest-count edit
 * three components away. A number is a primitive, so the extra `useSyncExternalStore` call is free
 * of the "new object every read" trap. */
export function useCartCount(): number {
  return useCart().items.length
}
