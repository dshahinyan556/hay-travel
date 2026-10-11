/**
 * Auth domain types and the wire DTOs of `api/Auth` / `api/Users`.
 *
 * A leaf module: the only things it imports are `EmployeeJobRole` (`shared/types/employeeRole.ts`),
 * `LanguageCode` (`shared/types/language.ts`) and `AccessLevel` (`./screens`), all three themselves
 * zero-import leaves — so every other auth file (and every feature) can still depend on this module
 * without creating a cycle.
 */

import type { EmployeeJobRole } from '@/shared/types/employeeRole'
import type { LanguageCode } from '@/shared/types/language'
import type { AccessLevel } from './screens'

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
  /** Read-only access to orders/lines they're assigned to (checklist-orders-redesign.txt, Фаза
   * 2/9) — does not reuse TourManager, which has full tour-management rights, a different
   * permission boundary. */
  Employee: 4,
} as const

export type RoleType = (typeof RoleType)[keyof typeof RoleType]

/** Role names as they appear in the JWT `role` claim (`user.Role.Type.ToString()` server-side). */
export const ROLE_NAME_TO_TYPE: Record<string, RoleType> = {
  Regular: RoleType.Regular,
  TourManager: RoleType.TourManager,
  Admin: RoleType.Admin,
  Employee: RoleType.Employee,
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
  /**
   * `null` for an account on a CUSTOM role: such a role has `UserRole.Type = null` server-side, so
   * the token carries no `role` claim at all. It means "the role is not one of the four built-in
   * tiers", NOT "no role" — and it is emphatically not a reason to reject the token (doing so used
   * to sign the user out on every reload). Compare it against `RoleType` only where a BUILT-IN tier
   * is genuinely the question (SuperAdmin, «Исполнитель»); everything else asks `shared/auth`'s
   * matrix predicates.
   */
  role: RoleType | null
  /**
   * Does this account reach anything under `/admin` at all? Written ONLY from an access token
   * (`is_admin` claim, or a non-empty `perms`) — the same four write sites as `isSuperAdmin`
   * (ADR 011, ADR 024).
   *
   * It exists for the PUBLIC site, which renders one «Админ-панель» link and must not fetch the
   * whole permission matrix to decide about it. Inside `/admin` nothing reads this: there the
   * resolved matrix is loaded and authoritative.
   */
  hasPanelAccess?: boolean
  firstName?: string
  lastName?: string | null
  phoneNumber?: string
  isEmailVerified?: boolean
  /**
   * The one SuperAdmin flag OF THE SIGNED-IN ACCOUNT (ADR 011). Written ONLY from the access
   * token's `is_super_admin` claim.
   *
   * `UserInfoModel`/`UserDetailInfoModel` grew an `isSuperAdmin` of their own on 2026-08-27, which
   * relaxed D6 — but that one describes the account being LOOKED AT on an admin screen and is not
   * a second source for this one: a claim inside a signed token and a field in a response body are
   * not interchangeable evidence about who you are. The module invariant in `authStore` still
   * stands, `toAuthUser` still refuses to copy it.
   *
   * Absent and `false` mean the same thing; never test it truthily, always `=== true`, and prefer
   * asking `canManageAdmins(user)` in `permissions.ts` over reading the field at a call site.
   */
  isSuperAdmin?: boolean
  /**
   * May this account sign in as somebody else — the `can_impersonate` claim (spec 014 §2.3).
   *
   * Same discipline as `isSuperAdmin`/`hasPanelAccess`: written ONLY from an access token (the
   * backend emits the claim only when the role carries the privilege or the account is SuperAdmin),
   * never from a DTO — no DTO carries it. Absent and `false` mean the same thing; ask
   * `canImpersonate(user)` from `permissions.ts` rather than reading the field at a call site.
   */
  canImpersonate?: boolean
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
  /**
   * «Запомнить меня» (spec 014 §4). A PER-SESSION choice, not an account setting: `true` gives the
   * 14-day refresh window and a persistent cookie, `false` (the backend's own default, and the
   * form's) gives a 1-hour sliding inactivity window and a session cookie.
   *
   * Required rather than optional so the single call site has to state which it means — the two
   * answers have very different security consequences to leave to an implicit default.
   */
  rememberMe: boolean
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
  /** `null` for a custom role — see `AuthUser.role`. */
  role: RoleType | null
  /** The role row's name. THE source of a role caption in the UI: with user-created roles, the
   * `RoleType` enum no longer describes a role completely (a custom one has no enum value at all),
   * so `roleLabels[user.role]` is not a valid substitute. */
  roleName: string
  isEmailVerified: boolean
  isLocked: boolean
  /**
   * Is THIS account the SuperAdmin (2026-08-27)? Sent since `SuperAdminGuard` made that account
   * untouchable by everyone else on every write path of `api/Users`: without the flag on the row,
   * the panel could only guess at the rule through `roleHoldsCanManageAdmins`, which is a different
   * question (the guard is keyed on the ACCOUNT, and a SuperAdmin may sit on a role that does not
   * carry `CanManageAdmins`) and would leave controls live that the server always refuses.
   *
   * This is the TARGET's flag, for disabling admin actions on it. It says nothing about the signed-
   * in user — that one is `AuthUser.isSuperAdmin`/`canManageAdmins(actor)` and comes from the token.
   */
  isSuperAdmin: boolean
  /** Default job role for the assignment popup (Задача D) — `null` when never set, valid for any
   * account (not only `RoleType.Employee`), the profile field carries no such restriction. */
  defaultJobRole: EmployeeJobRole | null
  /** Язык писем этого получателя (редизайн 2026-08-23). Решает, какая языковая версия шаблона
   * ему уйдёт. Non-nullable: «языка нет» — не состояние, у поля есть безопасный дефолт. */
  preferredLanguage: LanguageCode
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

/** `PATCH api/Users/SetJobRole` — sets/clears the profile's default job role (Задача D). `null` is
 * a valid, explicit "снять роль по умолчанию" — the real gate ("нельзя назначить без роли") lives
 * on the assignment endpoint itself, not here. */
export interface SetUserJobRoleModel {
  userId: number
  jobRole: EmployeeJobRole | null
}

/** `PATCH api/Users/SetPreferredLanguage` — язык писем пользователя (редизайн 2026-08-23). По нему
 * notification-сервис выбирает языковую версию шаблона. Non-nullable: значение вне enum сервер не
 * отбивает ошибкой, а роняет в дефолт (`Russian`) — см. `UserPreferredLanguageUpdateService`. */
export interface SetUserPreferredLanguageModel {
  userId: number
  preferredLanguage: LanguageCode
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
  /** `null` for a custom role — see `UserInfoModel.role`. */
  role: RoleType | null
  /** The role row's name — the only caption the UI should print. See `UserInfoModel.roleName`. */
  roleName: string
  isEmailVerified: boolean
  isLocked: boolean
  /** See `UserInfoModel.isSuperAdmin` — same flag, same reason (2026-08-27). */
  isSuperAdmin: boolean
  /** Default job role for the assignment popup (Задача D) — `null` when never set. */
  defaultJobRole: EmployeeJobRole | null
  /** Язык писем этого получателя (редизайн 2026-08-23). Решает, какая языковая версия шаблона
   * ему уйдёт. Non-nullable: «языка нет» — не состояние, у поля есть безопасный дефолт. */
  preferredLanguage: LanguageCode
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

/**
 * One row of `GET api/Users/{id}/LoginHistory` (C2, 2026-08-09) — written on every SUCCESSFUL
 * login (not on a token refresh: rotating a token is not a login). Top 100, newest first.
 *
 * Admin-only by explicit product decision: the public `/account` screen does NOT show this ("это
 * для нас инфо" — see block C of `profile-account-checklist-2026-08-09.txt`).
 *
 * `ipAddress`/`userAgent` are always present (non-nullable columns); the three geo fields are
 * nullable — the geo database is optional on the backend and private/unknown addresses resolve to
 * nothing at all.
 */
export interface LoginHistoryEntryModel {
  ipAddress: string
  countryCode: string | null
  countryName: string | null
  city: string | null
  userAgent: string
  /** ISO-8601, UTC, no zone suffix guaranteed — parse before formatting. */
  loggedInAtUtc: string
}

/**
 * One LIVE session — an unrevoked, unexpired `RefreshToken` row (spec 017 §4). Returned by both
 * `GET api/Auth/Sessions` (your own) and `GET api/Users/{id}/Sessions` (an admin looking at
 * somebody else's), in the same shape, newest first.
 *
 * NOT the same thing as `LoginHistoryEntryModel`, even though the two read alike: that one is an
 * immutable audit record of a sign-in that already happened, this one is a CAPABILITY that still
 * exists and can be taken away. Which is also why this one is not admin-only — the visitor sees
 * their own list on `/account`, whereas the login history deliberately stays inside the panel.
 *
 * `id` is the revoke handle (the row's primary key); the token hash never leaves the server.
 * `createdByUserAgent` is nullable because rows created before spec 017 have none, and the three geo
 * fields are nullable for the same reason as on `LoginHistoryEntryModel` — the geo database is
 * optional server-side and private addresses resolve to nothing.
 */
export interface SessionModel {
  id: number
  createdByIp: string
  countryCode: string | null
  countryName: string | null
  city: string | null
  createdByUserAgent: string | null
  /** ISO-8601, UTC, no zone suffix guaranteed — parse with `shared/lib/date`'s helpers. */
  createdAtUtc: string
  /** When this session dies on its own. Sliding for a «запомнить меня»-less login (ADR 029), so it
   * moves forward on every refresh. */
  expiresAtUtc: string
  /**
   * Is this the session the request itself came from? Computed server-side by hashing the caller's
   * own refresh cookie, so it is meaningful ONLY in the self-service list — the admin view always
   * reports `false` (the admin is not that user, and there is nothing to compare against).
   */
  isCurrent: boolean
}

/* -------------------------------------------------------------------------- */
/*  Resolved permissions (GET api/Auth/MyPermissions)                          */
/* -------------------------------------------------------------------------- */

/**
 * One screen's resolved access — the role's level with the account's personal override applied,
 * then capped to what the screen actually supports (backend `AdminScreens.CapLevel`).
 *
 * ONE level, not four booleans, since spec 014 §1: each level implies every action below it. The
 * permission store still exposes the familiar four-flag `ScreenPermission` to the rest of the app —
 * it derives them from this level with the same `level >= action` rule the backend enforces.
 */
export interface MyScreenPermissionModel {
  screenKey: string
  level: AccessLevel
}

/**
 * `GET api/Auth/MyPermissions` — the frontend's permission contract (ADR 024).
 *
 * Read fresh from the database on every call, unlike the `perms` claim baked into the access token:
 * the claim is lossy (screens with `canView = false` are dropped from it) and is an internal token
 * format, not an API contract.
 */
export interface MyPermissionsModel {
  /** System Admin — full access, short-circuits every matrix check. */
  isAdmin: boolean
  /** ADR 011's flag. Carried here so one request answers both questions; NOT part of the matrix. */
  isSuperAdmin: boolean
  /** EVERY key of the backend registry, including the ones resolved to `canView: false`. */
  screens: MyScreenPermissionModel[]
}
