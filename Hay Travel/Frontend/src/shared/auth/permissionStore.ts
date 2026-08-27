/**
 * The resolved permission matrix: a second module-level observable, next to (never inside) the
 * auth store — ADR 024, decision 3.
 *
 * Why a separate store and not another field on `AuthState`: the two have different lifetimes
 * (a session belongs to every visitor, the matrix only to staff inside `/admin`), different
 * sources (a cookie refresh vs an authenticated GET) and different update rates. Merging them
 * would re-render the whole public site on events that do not concern it — the same argument that
 * kept the access token out of `AuthState` (ADR 007).
 *
 * Why a module and not a React context: the guards live in React Router loaders, which run outside
 * the component tree and cannot read a context. Same reasoning as `authStore`.
 *
 * DEPENDENCY DIRECTION (deliberate, do not "simplify"):
 *   shared/lib/http ← permissionsApi ← permissionStore ← authStore ← authFetch ← everything else
 * This module therefore must NOT import `authStore`. It still needs to wait for the session to be
 * resolved before asking the server who it is, so `authStore` REGISTERS that wait through
 * `setPermissionSessionProbe` — the same inversion `shared/lib/http` already uses for the bearer
 * token (`setAuthTokenProvider`).
 */

import { ApiError } from '@/shared/lib/http'
import { fetchMyPermissions } from './permissionsApi'
import { AccessLevel, ALL_ACCESS_LEVELS, PermissionAction, levelAllows, type ScreenKey } from './screens'
import type { MyPermissionsModel } from './types'

/* -------------------------------------------------------------------------- */
/*  Shape                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * What the signed-in account may do on one screen.
 *
 * The wire now carries a single `AccessLevel` per screen (spec 014 §1), not four independent
 * booleans — these four are DERIVED from it here, with the backend's own rule (`level >= action`).
 * The shape is kept because "may I create?" is the question every call site actually asks, and
 * because a level is not four independent answers: `canUpdate` implies `canView`, so a consumer
 * that only checks one flag cannot get an impossible combination out of this object.
 */
export interface ScreenPermission {
  canView: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}

/**
 * `idle` — never loaded; `loading` — the first request is in flight; `ready` — the set is current;
 * `error` — the last attempt failed and the set is empty (every predicate answers `false`).
 */
export type PermissionStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface PermissionSnapshot {
  status: PermissionStatus
  /** System Admin: short-circuits every predicate to `true`. */
  isAdmin: boolean
  /** ADR 011's flag, carried here only so one fetch answers both questions. Not part of the matrix. */
  isSuperAdmin: boolean
  /** Key → flags. A key absent from the response is absent here, and reads as "no access". */
  screens: Readonly<Record<ScreenKey, ScreenPermission>>
}

/* -------------------------------------------------------------------------- */
/*  State                                                                      */
/* -------------------------------------------------------------------------- */

const NO_SCREENS: Readonly<Record<ScreenKey, ScreenPermission>> = Object.freeze({})

const IDLE_SNAPSHOT: PermissionSnapshot = Object.freeze({
  status: 'idle',
  isAdmin: false,
  isSuperAdmin: false,
  screens: NO_SCREENS,
})

let state: PermissionSnapshot = IDLE_SNAPSHOT
const listeners = new Set<() => void>()

/** Single-flight: parallel loaders (React Router runs siblings concurrently) share one request. */
let inflight: Promise<PermissionSnapshot> | null = null

/** The snapshot is known to be behind the database (a new access token was just issued). */
let isStale = false

/** See the module doc comment — registered by `authStore`. Resolves to "somebody is signed in". */
type SessionProbe = () => Promise<boolean>
let sessionProbe: SessionProbe | null = null

/** Called once, from `authStore`'s module scope. */
export function setPermissionSessionProbe(probe: SessionProbe): void {
  sessionProbe = probe
}

/* -------------------------------------------------------------------------- */
/*  Store primitives                                                           */
/* -------------------------------------------------------------------------- */

/** Current snapshot. Referentially stable until the data actually changes, which is what
 * `useSyncExternalStore` requires to avoid an infinite render loop. */
export function getPermissions(): PermissionSnapshot {
  return state
}

export function subscribePermissions(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function setState(next: PermissionSnapshot): void {
  state = next
  for (const listener of listeners) listener()
}

/* -------------------------------------------------------------------------- */
/*  Mapping                                                                    */
/* -------------------------------------------------------------------------- */

/** Level → the four flags the rest of the app reads. `>=` is the backend's own comparison, not a
 * frontend convenience: `PermissionClaims.Allowed` decides exactly this way. */
export function screenPermissionOfLevel(level: AccessLevel): ScreenPermission {
  return {
    canView: levelAllows(level, PermissionAction.View),
    canCreate: levelAllows(level, PermissionAction.Create),
    canUpdate: levelAllows(level, PermissionAction.Update),
    canDelete: levelAllows(level, PermissionAction.Delete),
  }
}

function toSnapshot(model: MyPermissionsModel): PermissionSnapshot {
  const screens: Record<ScreenKey, ScreenPermission> = {}
  for (const row of model.screens ?? []) {
    // A level this bundle does not know (a value added on the backend later, or a malformed
    // response) must not read as "everything" — anything outside the known set is no access.
    const known = ALL_ACCESS_LEVELS.includes(row.level as AccessLevel)
    screens[row.screenKey] = screenPermissionOfLevel(known ? row.level : AccessLevel.None)
  }
  return {
    status: 'ready',
    isAdmin: model.isAdmin === true,
    isSuperAdmin: model.isSuperAdmin === true,
    screens,
  }
}

/** Structural comparison, so a background refetch that changed nothing does not re-render the
 * panel. Cheap: eleven rows of four booleans. */
function isSameSnapshot(a: PermissionSnapshot, b: PermissionSnapshot): boolean {
  if (a.status !== b.status || a.isAdmin !== b.isAdmin || a.isSuperAdmin !== b.isSuperAdmin) {
    return false
  }
  const keysA = Object.keys(a.screens)
  const keysB = Object.keys(b.screens)
  if (keysA.length !== keysB.length) return false
  return keysA.every((key) => {
    const left = a.screens[key]
    const right = b.screens[key]
    return (
      right !== undefined &&
      left.canView === right.canView &&
      left.canCreate === right.canCreate &&
      left.canUpdate === right.canUpdate &&
      left.canDelete === right.canDelete
    )
  })
}

function commit(next: PermissionSnapshot): void {
  if (!isSameSnapshot(state, next)) setState(next)
}

/* -------------------------------------------------------------------------- */
/*  Loading                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * @param background `true` for a refetch triggered by token rotation or an explicit refresh: the
 *   previous snapshot stays on screen while the request runs, and a failure leaves it in place
 *   (only marking the set stale) instead of blanking the panel over a transient network blip.
 */
function load(background: boolean): Promise<PermissionSnapshot> {
  if (!background && state.status !== 'ready') {
    commit({ status: 'loading', isAdmin: false, isSuperAdmin: false, screens: NO_SCREENS })
  }

  const promise = (async () => {
    try {
      // No deadlock with `ensureAuthReady`'s own bootstrap: the only call that can run while the
      // bootstrap is still pending is `invalidatePermissions()` from inside `refreshAccessToken`,
      // and that one is a no-op unless the set was ALREADY loaded (i.e. the bootstrap is long done).
      const signedIn = sessionProbe === null ? true : await sessionProbe()
      if (!signedIn) {
        isStale = false
        commit({ status: 'ready', isAdmin: false, isSuperAdmin: false, screens: NO_SCREENS })
        return state
      }

      const model = await fetchMyPermissions()
      isStale = false
      commit(toSnapshot(model))
      return state
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        // The session died under us. Not "no permissions" — no session at all; `authFetch`/the
        // next navigation will surface that, and `AdminErrorBoundary` renders "Сессия истекла".
        clearPermissions()
        throw error
      }
      if (background) {
        // Keep whatever we had; the next `ensurePermissionsReady()` retries because of `isStale`.
        isStale = true
        throw error
      }
      isStale = false
      commit({ status: 'error', isAdmin: false, isSuperAdmin: false, screens: NO_SCREENS })
      throw error
    } finally {
      inflight = null
    }
  })()

  inflight = promise
  return promise
}

/**
 * Make sure the matrix is loaded. Every admin loader awaits this before asking a predicate.
 *
 * PROPAGATES failures (ADR 024, "Последствия"): a network error must reach `AdminErrorBoundary`
 * as "не удалось загрузить / Повторить". Silently degrading to "you have no rights" would be the
 * worst possible outcome for an administrator with a flaky connection.
 */
export function ensurePermissionsReady(): Promise<PermissionSnapshot> {
  if (inflight) return inflight
  if (state.status === 'ready' && !isStale) return Promise.resolve(state)
  return load(false)
}

/**
 * Re-read the matrix after the signed-in user may have changed their OWN rights (saved a role,
 * saved an override). Never rejects: on failure the previous snapshot stays and is returned.
 */
export function refreshPermissions(): Promise<PermissionSnapshot> {
  isStale = true
  const pending = inflight
  const run = pending
    ? pending.catch(() => state).then(() => load(true))
    : load(true)
  return run.catch(() => state)
}

/**
 * Mark the set out of date. Called by `authStore` on every access-token issue: the backend
 * resolves rights from the database at exactly that moment, so re-reading now keeps the UI and the
 * server's enforcement describing the same database state (ADR 024, decision 2).
 *
 * Nothing is fetched when the set was never loaded — that is an ordinary visitor on the public
 * site, who must not pay for a request they will never use.
 */
export function invalidatePermissions(): void {
  isStale = true
  if (state.status !== 'ready') return
  // Fire-and-forget: a failed background refresh keeps the old snapshot (see `load`).
  void load(true).catch(() => undefined)
}

/** Back to `idle`/empty. Called by `authStore` on logout and on a failed session restore. */
export function clearPermissions(): void {
  isStale = false
  inflight = null
  commit(IDLE_SNAPSHOT)
}
