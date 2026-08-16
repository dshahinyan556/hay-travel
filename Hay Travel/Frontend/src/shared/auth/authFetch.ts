/**
 * `apiFetch` + the bearer token + transparent silent refresh.
 *
 * Every authenticated call in the app goes through here. Call sites keep the exact same shape they
 * had with `apiFetch` — the token, the expiry check and the one retry are invisible to them.
 */

import { ApiError, apiFetch } from '@/shared/lib/http'
import { authErrorCodeOf } from './authErrors'
import { ensureAuthReady, getAccessToken, isAccessTokenExpiring, refreshAccessToken } from './authStore'

/**
 * The session is over and could not be renewed — as opposed to `ApiError(403)`, which means "you
 * are signed in, you just may not do this". Thrown from a loader it is caught by
 * `AdminErrorBoundary`, which offers a link back to `/auth` instead of a "server error" panel.
 */
export class SessionExpiredError extends Error {
  constructor(message = 'Session expired') {
    super(message)
    this.name = 'SessionExpiredError'
  }
}

/**
 * Perform an authenticated JSON request.
 *
 * Flow: wait for the store to settle → refresh pre-emptively if the token is about to expire →
 * send with `Authorization: Bearer` → on 401, refresh ONCE and replay.
 *
 * Anything that is not a 401 propagates untouched, 403 very much included: a TourManager pressing
 * an Admin-only action must see "нет прав", not get signed out.
 *
 * @param path Path relative to the API base, e.g. `api/Tour/GetAll`.
 * @param init Standard `fetch` options.
 * @throws {SessionExpiredError} when the session cannot be renewed.
 * @throws {ApiError} for any other non-2xx response.
 *
 * LIMITATION: `init.body` must be a string, a `FormData`, or absent. The retry re-sends the same
 * `init` object, so the body must be safely re-readable. A `FormData` is fine — `fetch` reads its
 * entries fresh on each call, it isn't a stream that gets drained — but a raw `ReadableStream`
 * body would already be consumed by the first attempt and must never be passed here.
 */
export async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  await ensureAuthReady()

  if (isAccessTokenExpiring()) {
    await refreshAccessToken()
  }

  try {
    return await send<T>(path, init, getAccessToken())
  } catch (error) {
    if (!isAuthChallenge(error)) throw error

    const token = await refreshAccessToken()
    if (!token) throw new SessionExpiredError()

    try {
      return await send<T>(path, init, token)
    } catch (retryError) {
      // A second challenge on a token the server issued a moment ago means the session is
      // genuinely dead (revoked, user locked) — retrying again would only loop.
      if (isAuthChallenge(retryError)) throw new SessionExpiredError()
      throw retryError
    }
  }
}

/**
 * Is this 401 the auth middleware rejecting the token, or a controller reporting a domain failure?
 *
 * The distinction matters: `ChangePassword` answers 401 `InvalidCredentials` (2200) when the
 * CURRENT password is wrong. Treating that as an expired session would rotate the refresh token,
 * replay the request, and finally sign a perfectly valid session out — over a typo.
 *
 * Domain errors always carry `errorCode` in the body (`ErrorModelExceptionHandler`); the JWT
 * middleware's challenge has no body at all. So a bodyless/codeless 401 — and only that — is a
 * reason to refresh.
 */
function isAuthChallenge(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401 && authErrorCodeOf(error) === undefined
}

/** One attempt with the given token. Without a token the request goes out unauthenticated, which
 * lets the server answer 401 and drive the refresh path above rather than us guessing. */
function send<T>(path: string, init: RequestInit | undefined, token: string | null): Promise<T> {
  const headers = new Headers(init?.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return apiFetch<T>(path, { ...init, headers })
}
