/**
 * React bindings for the permission store — the component-side counterpart of the loader-side
 * predicates in `permissions.ts`.
 *
 * Rule of thumb, and it matters: inside a component use THESE hooks, never `canView(...)` directly.
 * A bare predicate call reads the store once with no subscription, so after a background refresh
 * (token rotation, or the admin editing their own role) the buttons would keep rendering the old
 * answer. In a loader it is the other way round — hooks cannot run there, and the loader has just
 * awaited a fresh set anyway.
 */

import { useMemo, useSyncExternalStore } from 'react'
import { getPermissions, subscribePermissions, type PermissionSnapshot, type ScreenPermission } from './permissionStore'
import { resolveScreenPermissionIn } from './permissions'
import type { KnownScreenKey } from './screens'

/** The whole snapshot. Re-renders only when the resolved set actually changed. */
export function usePermissions(): PermissionSnapshot {
  // `getPermissions` doubles as the server snapshot: this app is client-rendered only.
  return useSyncExternalStore(subscribePermissions, getPermissions, getPermissions)
}

/**
 * The four flags of one screen, with the "canView is the gate" rule and the admin shortcut already
 * applied.
 *
 * Memoised on (snapshot, key): the snapshot is referentially stable, so the returned object is too,
 * and it can safely be listed in a `useEffect` dependency array or passed to a memoised child.
 */
export function useScreenPermission(screen: KnownScreenKey): ScreenPermission {
  const snapshot = usePermissions()
  return useMemo(() => resolveScreenPermissionIn(snapshot, screen), [snapshot, screen])
}
