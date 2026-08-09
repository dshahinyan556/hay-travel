/**
 * The four-step email-change flow (B8, shipped on the backend 2026-08-06; this is its first UI).
 *
 * Why four steps and not one: changing the address that owns the account is a takeover if it can be
 * done from a hijacked session alone. So the flow proves possession of BOTH mailboxes —
 *
 *   1. `RequestEmailChange`      → a short code is emailed to the CURRENT address;
 *   2. `ConfirmEmailChangeCode`  → that code is entered here (2208 if wrong/expired);
 *   3. `RequestNewEmail`         → the new address is submitted, a link is emailed to IT
 *                                  (2210 if step 2 was skipped, 2211 if the address is taken);
 *   4. `ConfirmEmailChange`      → the link's token is spent (2209 if invalid/expired).
 *
 * Steps 1-3 are `[Authorize]` and live inline on `/account`. Step 4 is ANONYMOUS by necessity — the
 * link is opened from the new mailbox, quite possibly in a different browser with no session — so
 * it goes through `apiFetch`, not `authFetch`, and has its own route (`ConfirmEmailChangePage`).
 */

import { authFetch, type MessageResultModel } from '@/shared/auth'
import { apiFetch } from '@/shared/lib/http'

/** Step 1. No body: the address to mail is the one on the account. */
export function requestEmailChange(): Promise<MessageResultModel> {
  return authFetch<MessageResultModel>('api/Auth/RequestEmailChange', { method: 'POST' })
}

/** Step 2. Rejects with `errorCode` 2208 (`EmailChangeCodeInvalid`) for a wrong or expired code. */
export function confirmEmailChangeCode(code: string): Promise<MessageResultModel> {
  return authFetch<MessageResultModel>('api/Auth/ConfirmEmailChangeCode', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

/** Step 3. Rejects with 2210 (`EmailChangeNotConfirmed`) or 2211 (`EmailAlreadyTaken`). */
export function requestNewEmail(newEmail: string): Promise<MessageResultModel> {
  return authFetch<MessageResultModel>('api/Auth/RequestNewEmail', {
    method: 'POST',
    body: JSON.stringify({ newEmail }),
  })
}

/**
 * Step 4 — anonymous. Rejects with 2209 (`EmailChangeLinkInvalid`) for a spent/expired token.
 *
 * `POST`, never a `GET` link: mail clients and link-preview crawlers prefetch `GET` URLs, which
 * would burn this one-time token before the recipient ever clicked it (the same trap
 * `VerifyEmailPage` documents).
 */
export function confirmEmailChange(token: string): Promise<MessageResultModel> {
  return apiFetch<MessageResultModel>('api/Auth/ConfirmEmailChange', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}
