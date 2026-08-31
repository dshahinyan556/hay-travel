/**
 * `api/Auth/Sessions*` — the visitor's own device/session list (spec 017 §4).
 *
 * These sit BELOW the store, on `authFetch`: `http ← authApi ← authStore ← authFetch ← sessionsApi`.
 * They are deliberately NOT in `authApi.ts`, which must stay free of `authFetch` because the store
 * itself imports it (`authApi ← authStore`) — putting an `authFetch` call there would close that
 * chain into a cycle. Same split `features/auth/api/changePassword.ts` already documents for the one
 * other authenticated `api/Auth` endpoint; these three live in `shared/auth` rather than in a
 * feature only because BOTH surfaces of the app read the same shape (the admin's variant is in
 * `features/admin/api/adminUsers.ts`) and the type is the auth core's.
 *
 * Path casing is load-bearing here for a second reason on top of `authApi`'s: the refresh cookie is
 * scoped to `Path=/api/Auth`, so `Sessions` and `Sessions/RevokeOthers` receive it automatically —
 * which is exactly how the server knows WHICH row is `isCurrent` and which one to spare. That also
 * means `credentials: 'include'` matters on the two calls that need the cookie; `authFetch` does not
 * add it, so they pass it explicitly.
 *
 * No call here ever ends the caller's own session — the current row is not offered for revocation by
 * the UI, and `RevokeOthers` keeps it by design. If a session does die anyway (an admin revoked it),
 * the global `authFetch` → 401 → `SessionExpiredError` path is what handles it; nothing in this
 * module or its UI touches `logout()`/`clearSession()`.
 */

import { authFetch } from './authFetch'
import type { SessionModel } from './types'

/**
 * Every live session of the signed-in account, newest first.
 *
 * `credentials: 'include'` so the refresh cookie travels: without it the server cannot mark
 * `isCurrent` on any row, and the list would offer to revoke the device the visitor is holding.
 */
export function getMySessions(): Promise<SessionModel[]> {
  return authFetch<SessionModel[]>('api/Auth/Sessions', { credentials: 'include' })
}

/**
 * End one session by row id (204). Idempotent — an already-revoked row is a no-op, so a stale list
 * does not produce an error.
 *
 * 404 `RelationalEntityNotFound` (2003) when the id belongs to somebody else: the server checks
 * ownership rather than trusting the id, which is what keeps this from being an IDOR.
 */
export function revokeMySession(id: number): Promise<void> {
  return authFetch<void>(`api/Auth/Sessions/${id}`, { method: 'DELETE' })
}

/**
 * End every session EXCEPT the one this request came from (204) — the «выйти на других устройствах»
 * button.
 *
 * `credentials: 'include'` is not optional: the cookie is the only thing that identifies the session
 * to keep. Without it the server has nothing to spare and would sign the caller out too.
 */
export function revokeMyOtherSessions(): Promise<void> {
  return authFetch<void>('api/Auth/Sessions/RevokeOthers', {
    method: 'POST',
    credentials: 'include',
  })
}
