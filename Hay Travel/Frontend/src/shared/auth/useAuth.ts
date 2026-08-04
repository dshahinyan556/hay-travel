/**
 * React binding for the module-level store.
 *
 * `useSyncExternalStore` is the correct primitive here (not `useState` + an effect): it subscribes
 * during render, so a component can never paint a snapshot that was already stale when it mounted,
 * and it works with concurrent rendering.
 *
 * Read-only by design — mutations are plain function calls on the store (`login`, `logout`, …),
 * which loaders need to make too.
 */

import { useSyncExternalStore } from 'react'
import { getAuthState, subscribeAuth } from './authStore'
import type { AuthState } from './types'

/**
 * The current auth snapshot. Re-renders only when the snapshot object is replaced — silent token
 * refreshes do not touch it (the token is not part of `AuthState`).
 *
 * `status` is `'idle' | 'loading'` while the session is still being resolved on a cold load; treat
 * that as "unknown" rather than "signed out" if the difference is visible to the user.
 */
export function useAuth(): AuthState {
  // `getAuthState` doubles as the server snapshot: this app is client-rendered only (no SSR), and
  // the initial state is the honest answer for a first paint anyway.
  return useSyncExternalStore(subscribeAuth, getAuthState, getAuthState)
}
