/**
 * Translating backend auth failures into dictionary keys.
 *
 * The API reports domain failures as `{ message, errorCode }` (the project-wide shape, see
 * `catalogErrors.ts`). Auth occupies the 2200 block of `GlobalErrorCode`.
 *
 * One deliberate gap: DTO validation failures (e.g. a password shorter than 8 chars) come back
 * as stock ASP.NET `ProblemDetails` with NO `errorCode` — the project never wires up
 * `FieldValidationActionFilter` (a known, accepted limitation, not just in auth). Hence the
 * "400 without a code → validation" fallback below; the frontend also mirrors the length rule in
 * `features/auth/lib/passwordRules.ts` so that case is normally caught before the request.
 */

import { ApiError } from '@/shared/lib/http'
import type { TranslationKey } from '@/shared/i18n/dictionary'

/** `GlobalErrorCode` values in the auth range (`ATTours.Helper/Enums/GlobalErrorCode.cs`). */
export const AuthErrorCode = {
  InvalidCredentials: 2200,
  AccountLocked: 2201,
  EmailNotVerified: 2202,
  VerificationTokenInvalid: 2203,
  ResetTokenInvalid: 2204,
  UsernameTaken: 2205,
  RoleNotFound: 2206,
  RefreshTokenInvalid: 2207,
} as const

export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode]

/** Pull `errorCode` out of an error body, tolerating both casings. */
export function authErrorCodeOf(err: unknown): number | undefined {
  if (!(err instanceof ApiError)) return undefined
  const body = err.body
  if (typeof body !== 'object' || body === null) return undefined
  const record = body as Record<string, unknown>
  const raw = record.errorCode ?? record.ErrorCode
  return typeof raw === 'number' ? raw : undefined
}

const CODE_TO_KEY: Record<number, TranslationKey> = {
  [AuthErrorCode.InvalidCredentials]: 'auth.error.invalidCredentials',
  [AuthErrorCode.AccountLocked]: 'auth.error.accountLocked',
  [AuthErrorCode.EmailNotVerified]: 'auth.error.emailNotVerified',
  [AuthErrorCode.VerificationTokenInvalid]: 'auth.error.verificationTokenInvalid',
  [AuthErrorCode.ResetTokenInvalid]: 'auth.error.resetTokenInvalid',
  [AuthErrorCode.UsernameTaken]: 'auth.error.usernameTaken',
}

/**
 * Map anything thrown by an auth call to a user-facing dictionary key.
 *
 * Order matters: a known code wins; a bodyless/codeless 400 is a validation failure; anything
 * that is not an `ApiError` never reached the server (offline, DNS, CORS) and is reported as a
 * network problem rather than "wrong password".
 */
export function authErrorMessageKey(err: unknown): TranslationKey {
  if (!(err instanceof ApiError)) return 'auth.error.network'

  const code = authErrorCodeOf(err)
  if (code !== undefined && code in CODE_TO_KEY) return CODE_TO_KEY[code]
  if (err.status === 400) return 'auth.error.validation'
  return 'auth.error.generic'
}
