/**
 * `api/Auth` — the anonymous / cookie-authenticated endpoints only.
 *
 * These are the calls the store itself makes, so this module must NOT depend on `authFetch`
 * (which depends on the store): `http ← authApi ← authStore ← authFetch`. The one authenticated
 * auth endpoint, `ChangePassword`, therefore lives with its screen in
 * `features/auth/api/changePassword.ts` instead of here.
 *
 * Path casing is load-bearing: the refresh cookie is issued with `Path=/api/Auth`, and cookie
 * paths are case-SENSITIVE. Requests to `/api/auth/...` would simply not carry it.
 */

import { apiFetch } from '@/shared/lib/http'
import type {
  AccessTokenModel,
  ForgotPasswordRequest,
  LoginRequest,
  LoginResultModel,
  MessageResultModel,
  RegisterRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
} from './types'

/**
 * `credentials: 'include'` is required on the three cookie endpoints — the refresh token is an
 * httpOnly cookie, and cross-origin `fetch` omits cookies by default. The backend's CORS policy
 * lists the exact dev/prod origins and sets `AllowCredentials` to match (a wildcard origin is
 * incompatible with credentials).
 */
const WITH_COOKIE: RequestInit = { credentials: 'include' }

/** Sets the refresh cookie on success. 401 InvalidCredentials / 401 AccountLocked /
 * 403 EmailNotVerified. */
export function loginRequest(request: LoginRequest): Promise<LoginResultModel> {
  return apiFetch<LoginResultModel>('api/Auth/Login', {
    ...WITH_COOKIE,
    method: 'POST',
    body: JSON.stringify(request),
  })
}

/** Exchanges the refresh cookie for a fresh access token and rotates the cookie. 401 when the
 * cookie is missing//expired/revoked, or when the user got locked or de-verified since login. */
export function refreshRequest(): Promise<AccessTokenModel> {
  return apiFetch<AccessTokenModel>('api/Auth/RefreshToken', { ...WITH_COOKIE, method: 'POST' })
}

/** Revokes the refresh token server-side and clears the cookie. Idempotent (204). */
export function logoutRequest(): Promise<void> {
  return apiFetch<void>('api/Auth/Logout', { ...WITH_COOKIE, method: 'POST' })
}

/**
 * Creates an unverified account and emails a verification token. Does NOT log the user in —
 * `Login` answers 403 EmailNotVerified until the token is used.
 *
 * An already-registered email returns a generic 200 (no account enumeration); if that account is
 * still unverified the mail is re-sent, which is also the "resend" path — there is no separate
 * endpoint. A taken username is a real 400 UsernameTaken, since usernames are public anyway.
 */
export function registerRequest(request: RegisterRequest): Promise<MessageResultModel> {
  return apiFetch<MessageResultModel>('api/Auth/Register', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

/**
 * Re-sends the verification email for an address that registered but never confirmed.
 *
 * Added 2026-08-27, after `Register`'s implicit resend (see above) turned out to be the only way
 * to get a second letter — which meant re-typing the whole sign-up form. The answer is the same
 * generic 200 as `Register`/`ForgotPassword`, deliberately indistinguishable between "sent",
 * "no such address", "already verified" and "still inside the 60s server-side cooldown": anything
 * else would turn this into an account-existence oracle. The caller therefore cannot learn whether
 * a letter actually went out — the cooldown is mirrored in the UI purely so the button doesn't
 * invite pointless clicks.
 *
 * `devToken` comes back non-null only when a letter was really sent AND no mail provider is
 * configured (`DevEmailSender`); the resend rotates the token, so a previously shown dev link
 * stops working.
 */
export function resendVerificationRequest(email: string): Promise<MessageResultModel> {
  return apiFetch<MessageResultModel>('api/Auth/ResendVerification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

/** 400 VerificationTokenInvalid when unknown/expired/already used. */
export function verifyEmailRequest(request: VerifyEmailRequest): Promise<MessageResultModel> {
  return apiFetch<MessageResultModel>('api/Auth/VerifyEmail', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

/** Always 200, whether or not the address exists — deliberately not an existence oracle. */
export function forgotPasswordRequest(request: ForgotPasswordRequest): Promise<MessageResultModel> {
  return apiFetch<MessageResultModel>('api/Auth/ForgotPassword', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

/** On success also clears the lockout counters and revokes every refresh token of that user.
 * 400 ResetTokenInvalid otherwise. */
export function resetPasswordRequest(request: ResetPasswordRequest): Promise<MessageResultModel> {
  return apiFetch<MessageResultModel>('api/Auth/ResetPassword', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}
