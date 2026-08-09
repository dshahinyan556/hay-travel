/**
 * The auth store: a module-level observable, deliberately OUTSIDE React (ADR 007).
 *
 * React Router runs `loader`s outside the component tree, so `adminRootLoader` and every
 * per-section guard cannot read a React context. A plain module with a subscribe/getSnapshot pair
 * can be read from both worlds — loaders call it directly, components go through `useAuth`
 * (`useSyncExternalStore`). There is no `AuthProvider`, on purpose: a context would be a second
 * source of truth that the loaders still could not use.
 *
 * Token handling:
 *  - the ACCESS token lives only in this module's memory. It is never written to
 *    localStorage/sessionStorage — anything there is readable by any script on the origin and
 *    survives the tab, which is exactly what an XSS wants.
 *  - the REFRESH token is an httpOnly cookie the JS never sees; `credentials: 'include'` is what
 *    puts it on the wire (see `authApi`).
 *  - what IS persisted is a boolean-ish "session hint" (see `SESSION_HINT_KEY`), so a first-time
 *    visitor does not fire a doomed `RefreshToken` request on every page load.
 *
 * After a cold reload the user object is rebuilt by decoding the access-token payload rather than
 * fetching a profile: `GET api/Account/Me` exists since 2026-08-09 but is the ACCOUNT screen's
 * concern (it needs name/phone), not the session's — the store still only needs what the token
 * already carries (ADR 007).
 *
 * INVARIANT (ADR 011): `AuthUser.isSuperAdmin` is written ONLY from a decoded access token. No
 * path that builds a user from a `UserInfoModel` may overwrite it — that DTO never carries the
 * flag, so "not present" there means "unknown", not "false".
 */

import { loginRequest, logoutRequest, refreshRequest, registerRequest } from './authApi'
import {
  ROLE_NAME_TO_TYPE,
  type AuthState,
  type AuthUser,
  type LoginRequest,
  type MessageResultModel,
  type RegisterRequest,
  type RoleType,
  type UserInfoModel,
} from './types'

/* -------------------------------------------------------------------------- */
/*  State                                                                      */
/* -------------------------------------------------------------------------- */

const INITIAL_STATE: AuthState = { status: 'idle', user: null, forceChangePassword: false }

let state: AuthState = INITIAL_STATE
const listeners = new Set<() => void>()

/** In-memory only — see the module doc comment. */
let accessToken: string | null = null
/** Epoch ms at which `accessToken` stops being accepted, or 0 when there is no token. */
let accessTokenExpiresAt = 0

/** Single-flight guards: concurrent callers share one in-flight request instead of racing (and,
 * for refresh, instead of burning the one-time refresh cookie twice — the backend treats a reused
 * refresh token as theft and revokes the whole family). */
let bootstrapPromise: Promise<AuthState> | null = null
let refreshPromise: Promise<string | null> | null = null

/**
 * Bumped by every deliberate session change (`login`, `logout`). A refresh that started before the
 * bump is stale by the time it lands and must not write its result.
 *
 * The case this prevents is real and nasty: a refresh is in flight (slow network), the user signs
 * in meanwhile, `Login` rotates the refresh cookie — and the older request then fails against the
 * now-rotated token and would clear the session the user just established, seconds after a
 * successful login.
 */
let sessionEpoch = 0

/**
 * "There probably is a refresh cookie for this browser." NOT a token and not a security boundary
 * (the real check is the httpOnly cookie the server validates) — purely an optimisation so an
 * anonymous visitor does not pay a `POST RefreshToken` → 401 on every cold load.
 */
const SESSION_HINT_KEY = 'att.session'

/* -------------------------------------------------------------------------- */
/*  Store primitives                                                           */
/* -------------------------------------------------------------------------- */

/** Current snapshot. Referentially stable until something actually changes, which is what
 * `useSyncExternalStore` requires to avoid an infinite render loop. */
export function getAuthState(): AuthState {
  return state
}

/** Subscribe to state changes; returns the unsubscribe function. */
export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Replace the snapshot wholesale (never mutate it) and notify subscribers. */
function setState(next: AuthState): void {
  state = next
  for (const listener of listeners) listener()
}

/** The bearer token for `authFetch`. No other module should need it. */
export function getAccessToken(): string | null {
  return accessToken
}

/** Refresh this many ms before the token actually expires, so a request can't die in flight
 * because the token aged out between the check and the server reading it. */
const EXPIRY_SKEW_MS = 30_000

/**
 * True when there is a token but it is at (or within `EXPIRY_SKEW_MS` of) expiry.
 *
 * Not in the architect's listed API, but `authFetch` needs the "refresh proactively" check and
 * asking a named predicate is better than exporting the raw timestamp and re-deriving the skew
 * rule at the call site.
 */
export function isAccessTokenExpiring(): boolean {
  return accessToken !== null && Date.now() >= accessTokenExpiresAt - EXPIRY_SKEW_MS
}

/* -------------------------------------------------------------------------- */
/*  Session hint (localStorage)                                                */
/* -------------------------------------------------------------------------- */

/** Storage access can throw (Safari private mode, disabled cookies/storage). A failure here only
 * costs one wasted request, so it degrades silently in both directions. */
function readSessionHint(): boolean {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) === '1'
  } catch {
    return false
  }
}

function writeSessionHint(present: boolean): void {
  try {
    if (present) localStorage.setItem(SESSION_HINT_KEY, '1')
    else localStorage.removeItem(SESSION_HINT_KEY)
  } catch {
    /* ignore — see readSessionHint */
  }
}

/* -------------------------------------------------------------------------- */
/*  JWT payload decoding                                                       */
/* -------------------------------------------------------------------------- */

/** Decode a base64url segment into a UTF-8 string (`atob` handles neither `-`/`_` nor multibyte). */
function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** Read a claim that the token may carry under any of several names, as a single string. */
function claim(payload: Record<string, unknown>, ...names: string[]): string | undefined {
  for (const name of names) {
    const raw = payload[name]
    // A claim repeated in the token arrives as an array (roles, most often).
    const value = Array.isArray(raw) ? raw[0] : raw
    if (typeof value === 'string' && value !== '') return value
    if (typeof value === 'number') return String(value)
  }
  return undefined
}

/** Every name the role claim can appear under: `ClaimTypes.Role` is normally shortened to `role`
 * by `JwtSecurityTokenHandler`'s outbound map, but the long WS-* URI is what it would fall back
 * to if that map were ever cleared server-side. */
function roleClaim(payload: Record<string, unknown>): RoleType | undefined {
  const raw = claim(
    payload,
    'role',
    'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
  )
  if (raw === undefined) return undefined
  return ROLE_NAME_TO_TYPE[raw]
}

/**
 * Read the `is_super_admin` claim as a boolean (ADR 011, decision 3).
 *
 * The tolerance is not defensive padding, it is the actual contract: an ASP.NET `Claim` value is
 * ALWAYS a string, so a boolean claim arrives as `"true"` and a naive `payload.is_super_admin ===
 * true` would silently evaluate to `false` and disable the whole feature. Numbers are accepted too
 * in case the claim is ever emitted as `JsonClaimValueTypes.Integer`.
 *
 * Absence is the normal case — the backend adds the claim only when the flag is set.
 */
function isSuperAdminClaim(payload: Record<string, unknown>): boolean {
  const raw = payload.is_super_admin
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value === true) return true
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') return value.toLowerCase() === 'true' || value === '1'
  return false
}

/**
 * `is_super_admin` straight from a raw token — for the paths that have a token but do not (re)build
 * the whole user from it: `login()` (which gets a richer user from the response body) and the
 * mid-session refresh.
 *
 * Not verified, and it does not need to be: the backend re-reads the flag FROM THE DATABASE on
 * every guarded endpoint (`SuperAdminPrivilegeRequired`, 403), so a forged payload buys nothing but
 * a button that answers 403 — exactly the same reasoning ADR 007 records for `role`.
 */
function superAdminFromToken(token: string): boolean {
  try {
    const [, payloadSegment] = token.split('.')
    if (!payloadSegment) return false
    return isSuperAdminClaim(JSON.parse(decodeBase64Url(payloadSegment)) as Record<string, unknown>)
  } catch {
    return false
  }
}

/**
 * Rebuild the user from the access token's payload.
 *
 * The signature is NOT verified here — it cannot be, the key is server-side. That is fine: this
 * is only used to render a name and decide which buttons to show. Every actual permission is
 * re-checked by the API against the same token, so a forged payload buys nothing.
 *
 * Returns `null` for anything malformed, so a corrupt token degrades to "anonymous" instead of
 * throwing inside a loader.
 */
export function decodeAccessToken(token: string): AuthUser | null {
  try {
    const [, payloadSegment] = token.split('.')
    if (!payloadSegment) return null

    const payload = JSON.parse(decodeBase64Url(payloadSegment)) as Record<string, unknown>

    const id = Number(claim(payload, 'sub', 'nameid'))
    const username = claim(payload, 'unique_name', 'name')
    const email = claim(payload, 'email')
    const role = roleClaim(payload)

    if (!Number.isInteger(id) || id <= 0 || !username || !email || role === undefined) return null

    // Write site 2 of 4 for `isSuperAdmin` (ADR 011): the cold-reload path, where this decode IS
    // the user.
    return { id, username, email, role, isSuperAdmin: isSuperAdminClaim(payload) }
  } catch {
    return null
  }
}

/** Expiry from the token's own `exp` claim (seconds since epoch) when available; otherwise the
 * server-reported lifetime. Prefers `exp` because it is what the API will actually enforce. */
function expiryFromToken(token: string, expiresInSeconds: number): number {
  try {
    const [, payloadSegment] = token.split('.')
    if (payloadSegment) {
      const payload = JSON.parse(decodeBase64Url(payloadSegment)) as Record<string, unknown>
      if (typeof payload.exp === 'number') return payload.exp * 1000
    }
  } catch {
    /* fall through */
  }
  return Date.now() + expiresInSeconds * 1000
}

/* -------------------------------------------------------------------------- */
/*  Mapping                                                                    */
/* -------------------------------------------------------------------------- */

/** Wire user → UI user. Note `role` (the permission tier), never `roleId` (the table key). */
export function toAuthUser(model: UserInfoModel): AuthUser {
  return {
    id: model.id,
    username: model.username,
    email: model.email,
    role: model.role,
    firstName: model.firstName,
    lastName: model.lastName,
    phoneNumber: model.phoneNumber,
    isEmailVerified: model.isEmailVerified,
  }
}

/* -------------------------------------------------------------------------- */
/*  Session lifecycle                                                          */
/* -------------------------------------------------------------------------- */

function clearSession(): void {
  accessToken = null
  accessTokenExpiresAt = 0
  writeSessionHint(false)
}

/**
 * Resolve the session exactly once per page load, then hand the same answer to every later caller.
 *
 * Idempotent and safe to call from several loaders in parallel (React Router runs sibling loaders
 * concurrently) — they all await the same promise.
 */
export function ensureAuthReady(): Promise<AuthState> {
  if (bootstrapPromise) return bootstrapPromise

  bootstrapPromise = (async () => {
    if (!readSessionHint()) {
      setState({ status: 'anonymous', user: null, forceChangePassword: false })
      return state
    }

    setState({ status: 'loading', user: null, forceChangePassword: false })
    await refreshAccessToken()
    return state
  })()

  return bootstrapPromise
}

/**
 * Swap the refresh cookie for a new access token.
 *
 * NEVER throws — callers (`authFetch`, `ensureAuthReady`) treat `null` as "the session is gone"
 * and there is no useful distinction between "cookie expired", "user was locked since login" and
 * "network died" at this level. Single-flight: a burst of 401s produces one refresh, not N.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise

  const epoch = sessionEpoch

  refreshPromise = (async () => {
    try {
      const result = await refreshRequest()
      // Superseded by a login/logout that happened while this was in flight — drop the result
      // rather than overwrite a newer session with an older one.
      if (epoch !== sessionEpoch) return accessToken

      accessToken = result.accessToken
      accessTokenExpiresAt = expiryFromToken(result.accessToken, result.expiresInSeconds)
      writeSessionHint(true)

      // The refresh response carries no user — on a cold reload this decode IS the user. On a
      // routine mid-session refresh we already have a richer object (from `Login`) and keep it.
      const existing = state.user
      const user = existing ?? decodeAccessToken(result.accessToken)
      if (!user) {
        clearSession()
        setState({ status: 'anonymous', user: null, forceChangePassword: false })
        return null
      }

      // Write site 3 of 4 (ADR 011). The token is re-issued roughly every 15 minutes and is the
      // ONLY carrier of this flag — no endpoint and no DTO can report it — so even when the richer
      // existing user object is kept, `isSuperAdmin` is re-read from the fresh token. Deliberately
      // narrow: `role` and every other field on that object are still NOT refreshed here, because
      // widening this path would be fixing a different problem.
      const isSuperAdmin = superAdminFromToken(result.accessToken)
      const next =
        existing && existing.isSuperAdmin !== isSuperAdmin ? { ...existing, isSuperAdmin } : user

      setState({
        status: 'authenticated',
        user: next,
        forceChangePassword: state.forceChangePassword,
      })
      return accessToken
    } catch {
      if (epoch !== sessionEpoch) return accessToken

      clearSession()
      setState({ status: 'anonymous', user: null, forceChangePassword: false })
      return null
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

/** Sign in. Rejects with the raw `ApiError` so the form can map `errorCode` to a message. */
export async function login(request: LoginRequest): Promise<AuthState> {
  // Let any bootstrap refresh settle first, so the two cannot interleave their writes.
  await ensureAuthReady()

  sessionEpoch += 1
  setState({ status: 'loading', user: null, forceChangePassword: false })

  try {
    const result = await loginRequest(request)
    accessToken = result.accessToken
    accessTokenExpiresAt = expiryFromToken(result.accessToken, result.expiresInSeconds)
    writeSessionHint(true)

    setState({
      status: 'authenticated',
      // Write site 1 of 4 (ADR 011). `toAuthUser` alone is NOT enough: `UserInfoModel` never
      // carries `is_super_admin`, so the token has to be decoded on top of the response body.
      user: {
        ...toAuthUser(result.user),
        isSuperAdmin: superAdminFromToken(result.accessToken),
      },
      forceChangePassword: result.forceChangePassword,
    })
    // A successful login also answers the "is there a session?" question for this page load, so
    // the guard that runs right after the redirect must not re-bootstrap (and must not see the
    // pre-login `anonymous` snapshot cached from an earlier `ensureAuthReady`).
    bootstrapPromise = Promise.resolve(state)
    return state
  } catch (error) {
    clearSession()
    setState({ status: 'anonymous', user: null, forceChangePassword: false })
    throw error
  }
}

/**
 * Create an account. Deliberately does NOT sign the user in: `Login` answers 403 EmailNotVerified
 * until the emailed token is used, so a "logged in" state here would be a lie.
 */
export function register(request: RegisterRequest): Promise<MessageResultModel> {
  return registerRequest(request)
}

/**
 * Sign out. The local state is cleared in `finally`: if the network call fails, the user still
 * asked to leave, and leaving them "signed in" with a dead token is the worse outcome. (The
 * server-side token stays valid in that case, but it is httpOnly and expires on its own.)
 */
export async function logout(): Promise<void> {
  sessionEpoch += 1
  try {
    await logoutRequest()
  } finally {
    clearSession()
    setState({ status: 'anonymous', user: null, forceChangePassword: false })
    bootstrapPromise = Promise.resolve(state)
  }
}

/** Called once the forced password change has actually been performed. */
export function clearForceChangePassword(): void {
  if (!state.forceChangePassword) return
  setState({ ...state, forceChangePassword: false })
}

/**
 * Replace the current user — e.g. someone who just changed their own phone number on `/account`
 * and must see it without a reload. No-op when nobody is signed in.
 *
 * Write site 4 of 4 (ADR 011): callers build `user` from a `UserInfoModel`, which cannot carry
 * `isSuperAdmin`, so the flag is CARRIED OVER from the current user rather than taken from the
 * argument. Without this, saving your own phone number would silently demote a SuperAdmin for the
 * rest of the session.
 */
export function applyUser(user: AuthUser): void {
  const current = state.user
  if (!current) return
  setState({ ...state, user: { ...user, isSuperAdmin: current.isSuperAdmin } })
}
