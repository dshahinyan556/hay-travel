/**
 * Client-side mirror of the backend's DTO constraints (`RegisterModel`, `ResetPasswordModel`,
 * `ChangePasswordModel`).
 *
 * Not a substitute for server validation — it exists because a violated `[MinLength]` comes back
 * as stock ASP.NET `ProblemDetails` with no `errorCode` (a known, accepted backend limitation),
 * which can only be reported as a vague "проверьте поля". Catching it here lets the message name
 * the actual rule and point at the field.
 */

import type { TranslationKey } from '@/shared/i18n/dictionary'

/** `[MinLength(8)]` on every password field. */
export const MIN_PASSWORD_LENGTH = 8
/** `[MaxLength(128)]` — also the `maxLength` attribute on the inputs. */
export const MAX_PASSWORD_LENGTH = 128
/** `[MinLength(3)]` on `RegisterModel.Username`. */
export const MIN_USERNAME_LENGTH = 3
/** `[MaxLength(64)]` on `RegisterModel.Username`. */
export const MAX_USERNAME_LENGTH = 64

/** A message the caller still has to translate — validation must not bake in a language. */
export interface ValidationMessage {
  key: TranslationKey
  vars?: Record<string, string | number>
}

/** `null` when the password is acceptable. */
export function validatePassword(value: string): ValidationMessage | null {
  if (value.length < MIN_PASSWORD_LENGTH) {
    return { key: 'auth.error.passwordTooShort', vars: { min: MIN_PASSWORD_LENGTH } }
  }
  return null
}

/** `null` when both fields match. Assumes `password` itself was already validated. */
export function validateConfirm(password: string, confirm: string): ValidationMessage | null {
  return password === confirm ? null : { key: 'auth.error.passwordMismatch' }
}

/** `null` when the username is long enough. */
export function validateUsername(value: string): ValidationMessage | null {
  if (value.trim().length < MIN_USERNAME_LENGTH) {
    return { key: 'auth.error.usernameTooShort', vars: { min: MIN_USERNAME_LENGTH } }
  }
  return null
}
