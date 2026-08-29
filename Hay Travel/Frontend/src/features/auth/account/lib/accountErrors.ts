/**
 * Dictionary keys for the failures only the account screen can produce.
 *
 * `shared/auth/authErrors.ts` owns the shared 2200-block codes (bad password, locked account, …)
 * and is the fallback here. The codes below belong to the email-change flow (B8) and to Telegram
 * linking, and are meaningless anywhere else, so they stay in the feature rather than widening the
 * shared map — the same split `features/admin/users/lib/userCopy.ts` already uses for the
 * admin-only codes.
 */

import { authErrorCodeOf, authErrorMessageKey } from '@/shared/auth'
import type { TranslationKey } from '@/shared/i18n/dictionary'

/** `GlobalErrorCode` values in the email-change range (`ATTours.Helper/Enums/GlobalErrorCode.cs`). */
export const AccountErrorCode = {
  /** Step 2: the code mailed to the CURRENT address is wrong or expired. */
  EmailChangeCodeInvalid: 2208,
  /** Step 4: the link mailed to the NEW address is invalid, expired or already spent. */
  EmailChangeLinkInvalid: 2209,
  /** Step 3 attempted before step 2 succeeded — normally unreachable from this UI (the state
   * machine forbids it), so in practice it means the flow expired server-side mid-way. */
  EmailChangeNotConfirmed: 2210,
  /** Step 3: somebody else already owns that address. */
  EmailAlreadyTaken: 2211,
  /** Telegram linking (ADR 031): the server has no bot token / webhook secret, so it refuses to
   * mint a code that would only produce a dead deep link. Answered with 503, not 400 — nothing the
   * visitor typed is wrong. */
  TelegramNotConfigured: 2219,
} as const

export type AccountErrorCode = (typeof AccountErrorCode)[keyof typeof AccountErrorCode]

const CODE_TO_KEY: Record<number, TranslationKey> = {
  [AccountErrorCode.EmailChangeCodeInvalid]: 'account.error.codeInvalid',
  [AccountErrorCode.EmailChangeLinkInvalid]: 'account.error.linkInvalid',
  [AccountErrorCode.EmailChangeNotConfirmed]: 'account.error.notConfirmed',
  [AccountErrorCode.EmailAlreadyTaken]: 'account.error.emailTaken',
  [AccountErrorCode.TelegramNotConfigured]: 'account.error.telegramNotConfigured',
}

/**
 * Map anything thrown by an account call to a user-facing dictionary key. Account-specific codes
 * win; everything else (network failure, expired session, a bodyless 400) falls through to the
 * shared auth mapping, so those messages stay written in exactly one place.
 */
export function accountErrorMessageKey(err: unknown): TranslationKey {
  const code = authErrorCodeOf(err)
  if (code !== undefined && code in CODE_TO_KEY) return CODE_TO_KEY[code]
  return authErrorMessageKey(err)
}
