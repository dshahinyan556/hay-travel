/**
 * Thin fetch wrapper for the real backend.
 *
 * Unlike `shared/api/tours.ts` (a mock data source for the public site), this talks to a
 * live API. The base URL is injected at build time via `VITE_API_BASE_URL` so the same
 * bundle can point at different environments without code changes. Every admin API module
 * goes through `apiFetch` — call sites never touch `fetch` or the base URL directly.
 */

/**
 * Base URL of the API.
 *
 * Three-state on purpose:
 *  - unset  → configuration error, `apiFetch` throws with an actionable message (dev forgot `.env`);
 *  - a URL  → absolute cross-origin calls (local dev against `http://localhost:5253`);
 *  - EMPTY  → relative, same-origin paths (`/api/…`). That is the production setup: `netlify.toml`
 *    rewrites `/api/*` to the Azure backend, which keeps the refresh cookie first-party (see
 *    `.env.production`).
 */
const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()

/**
 * Bearer token to opportunistically attach to every request, or `null` when signed out.
 *
 * Registered by `shared/auth/authStore.ts` (`setAuthTokenProvider(getAccessToken)`) rather than
 * imported directly — `authApi.ts`'s own doc comment pins the dependency direction as
 * `http ← authApi ← authStore`, and `http` reaching up to import `authStore` would invert that
 * into a cycle. A callback registered from the auth side keeps `shared/lib` free of any `shared/
 * auth` import while still letting `apiFetch` reach the current token.
 *
 * Why `apiFetch` needs this at all (2026-08-11): the backend's `UserActivityTrackingMiddleware`
 * records "last active" off ANY request that carries a valid token, public endpoints included —
 * `UseAuthentication()` populates `HttpContext.User` from the header regardless of whether the
 * matched endpoint requires `[Authorize]`. But only `authFetch` (protected calls: `/account`,
 * admin, password changes) was attaching the header; ordinary browsing — `tours.ts`, `regions.ts`,
 * `siteSettings.ts` — went through this file's plain `apiFetch` with no token at all. So a signed-
 * in visitor's "last active" only ever moved on the rare protected action, not on the browsing
 * that was actually happening, and the admin "online" badge read stuck/stale. Attaching the token
 * here — opportunistically, not required — fixes that without adding a heartbeat/poll (an explicit
 * non-goal, see `onlineStatus.ts`): the requests were already happening, they just weren't carrying
 * proof of who was making them.
 */
let tokenProvider: (() => string | null) | null = null

/** See `tokenProvider` above. */
export function setAuthTokenProvider(provider: () => string | null): void {
  tokenProvider = provider
}

/** Thrown when the server responds with a non-2xx status. Carries the HTTP status and,
 * when the body could be parsed, the raw payload for callers that want to inspect it. */
export class ApiError extends Error {
  readonly status: number
  readonly body?: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

/** HTTP methods that carry a request body and therefore need a JSON content type. */
const METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Perform a JSON request against the backend and return the parsed response.
 *
 * @param path Path relative to the API base, e.g. `api/Tour/GetAll`.
 * @param init Standard `fetch` options (method, body, signal, …).
 * @throws {ApiError} when the response status is not ok.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (BASE_URL === undefined) {
    throw new Error(
      'VITE_API_BASE_URL is not set. Create a `.env` file (see `.env.example`) with the API base URL.',
    )
  }

  const url = joinUrl(BASE_URL, path)
  const method = (init?.method ?? 'GET').toUpperCase()

  const headers = new Headers(init?.headers)
  if (init?.body != null && METHODS_WITH_BODY.has(method) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  // No-op against a real backend; only matters when tunneled through ngrok's free tier, which
  // otherwise serves an HTML "visit site" interstitial in place of the JSON response.
  headers.set('ngrok-skip-browser-warning', 'true')
  // Opportunistic, not required — see `tokenProvider` above. `!headers.has(...)` lets `authFetch`'s
  // own explicit header (set from a just-refreshed token during its 401 retry) win over whatever
  // this provider would currently return.
  if (!headers.has('Authorization')) {
    const token = tokenProvider?.()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(url, { ...init, headers })
  const payload = await parseJsonSafe(res)

  if (!res.ok) {
    throw new ApiError(res.status, `Request to ${path} failed with status ${res.status}`, payload)
  }

  return payload as T
}

/** Join base and path with exactly one slash between them. */
function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

/** Parse the response body as JSON, tolerating empty bodies (e.g. 204 No Content). */
async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
