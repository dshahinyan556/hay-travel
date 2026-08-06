/**
 * Auth domain types and the wire DTOs of `api/Auth` / `api/Users`.
 *
 * A leaf module: it imports nothing, so every other auth file (and every feature) can depend on
 * it without creating a cycle.
 */

/* -------------------------------------------------------------------------- */
/*  Roles                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Mirrors the backend `RoleType` enum (`UserRole.Type`). Modelled as a frozen const object plus a
 * value-union rather than a TS `enum` because the project's tsconfig sets `erasableSyntaxOnly` —
 * same convention as `features/admin/lib/enums.ts`.
 */
export const RoleType = {
  Regular: 1,
  TourManager: 2,
  Admin: 3,
} as const

export type RoleType = (typeof RoleType)[keyof typeof RoleType]

/** Role names as they appear in the JWT `role` claim (`user.Role.Type.ToString()` server-side). */
export const ROLE_NAME_TO_TYPE: Record<string, RoleType> = {
  Regular: RoleType.Regular,
  TourManager: RoleType.TourManager,
  Admin: RoleType.Admin,
}

/* -------------------------------------------------------------------------- */
/*  Client-side auth state                                                     */
/* -------------------------------------------------------------------------- */

/**
 * `idle` — nothing attempted yet; `loading` — bootstrap/refresh in flight; then one of the two
 * terminal states. UI that must not flash "logged out" during a cold reload should treat
 * `idle`/`loading` as "unknown", not as anonymous.
 */
export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous'

/** The signed-in user as the UI knows them. Fields marked optional are absent when the user was
 * restored from JWT claims (cold reload) rather than from a `Login` response body. */
export interface AuthUser {
  id: number
  username: string
  email: string
  role: RoleType
  firstName?: string
  lastName?: string | null
  phoneNumber?: string
  isEmailVerified?: boolean
}

/**
 * The whole observable auth state.
 *
 * The access token is deliberately NOT here: it lives in a module-private variable in `authStore`
 * and is handed out only through `getAccessToken()`. Putting it in the snapshot would make every
 * silent refresh (every ~15 min, and on every 401 retry) re-render the entire subscribed tree for
 * a value no component renders.
 */
export interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  /** Server said this user must change their password before doing anything else. */
  forceChangePassword: boolean
}

/* -------------------------------------------------------------------------- */
/*  Wire DTOs (camelCase — ASP.NET serialises with the default camelCase policy) */
/* -------------------------------------------------------------------------- */

export interface LoginRequest {
  usernameOrEmail: string
  password: string
}

export interface RegisterRequest {
  firstName: string
  lastName?: string
  username: string
  email: string
  phoneNumber: string
  password: string
}

/**
 * `UserInfoModel` — returned by `Login`, `api/Users` and `api/Users/ChangeRole`.
 *
 * `role` and `roleId` are NOT the same thing: `roleId` is the `UserRole` row's primary key
 * (what `ChangeRole` expects), `role` is that row's `Type` — the permission tier this whole
 * module reasons about. The seed happens to give them equal values (rows 1/2/3), but only
 * `role` may be compared against `RoleType`.
 *
 * Enums come over the wire as numbers: the API serialises with Newtonsoft using a camelCase
 * resolver and no `StringEnumConverter`, same as `TourInfoModel.type`.
 */
export interface UserInfoModel {
  id: number
  firstName: string
  lastName: string | null
  username: string
  email: string
  phoneNumber: string
  roleId: number
  role: RoleType
  isEmailVerified: boolean
  isLocked: boolean
}

export interface LoginResultModel {
  accessToken: string
  expiresInSeconds: number
  user: UserInfoModel
  forceChangePassword: boolean
}

/** `RefreshToken` returns only this — there is no `Me` endpoint (see ADR 007). */
export interface AccessTokenModel {
  accessToken: string
  expiresInSeconds: number
}

/** Generic ack of the token-by-email endpoints. `devToken` is only populated by
 * `DevEmailSender` (no SendGrid key configured) and must never be shown in production. */
export interface MessageResultModel {
  message: string
  devToken?: string
}

export interface VerifyEmailRequest {
  token: string
}

export interface ForgotPasswordRequest {
  email: string
}

export interface ResetPasswordRequest {
  token: string
  newPassword: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface ChangeRoleRequest {
  userId: number
  roleId: number
}

/**
 * `UserDetailInfoModel` — returned only by `GET api/Users/{id}` (B13). A flat sibling of
 * `UserInfoModel`, not an extension of it on the wire (the backend DTO isn't a subclass either,
 * see `ATTours.Common/DTO/Auth/UserDetailInfoModel.cs`) — duplicates the base fields and adds the
 * four detail-only ones (IP/activity/registration), which deliberately never ship with the list
 * endpoint (see B13's reasoning in `admin-fixes-checklist-2026-08-06.txt`).
 *
 * `phoneNumber` is nullable here (unlike `UserInfoModel.phoneNumber` below, which predates B1 and
 * was not revisited as part of F4 — flagged as a pre-existing gap, not fixed here).
 */
export interface UserDetailInfoModel {
  id: number
  firstName: string
  lastName: string | null
  username: string
  email: string
  phoneNumber: string | null
  roleId: number
  role: RoleType
  isEmailVerified: boolean
  isLocked: boolean
  /** Last authenticated request, throttled server-side to at most once per 5 minutes (B7).
   * `null` when the account has never made one since the field was introduced. */
  lastActiveAtUtc: string | null
  registeredAtUtc: string
  /** `null` for accounts that registered before B2 shipped (no synthetic backfill). */
  registeredIp: string | null
  /** Misleadingly named on the backend (see B2's note): IP of the last AUTHENTICATED request,
   * not literally the last login. `null` until the first authenticated request after B7. */
  lastLoginIp: string | null
}
