/**
 * `api/Account/Telegram` — linking the signed-in account to `@HayTravelNotificationsBot`
 * (ADR 031 / spec 015).
 *
 * Its own module rather than three more functions in `api/account.ts`, for the same reason
 * `emailChange.ts` is separate: this is one self-contained flow with its own response shapes, and
 * `account.ts` stays the two-call profile surface its doc comment describes.
 *
 * All three endpoints are self-service — the user id comes from the bearer token, they take no
 * parameters at all, so there is no IDOR surface here (same guarantee as the rest of
 * `AccountController`).
 */

import { authFetch } from '@/shared/auth'

/** `GET api/Account/Telegram` response. */
export interface TelegramLinkStatusModel {
  isLinked: boolean
  /** Display only — the chat's `@username`. `null` both when nothing is linked AND when the linked
   * chat simply has no username set, so it can never stand in for `isLinked`. */
  telegramUsername: string | null
}

/** `POST api/Account/Telegram/LinkCode` response. */
export interface TelegramLinkCodeModel {
  /** Ready-made `https://t.me/HayTravelNotificationsBot?start=<code>` — composed by the backend
   * from its own configured bot username, so the frontend never hardcodes the bot name. */
  deepLinkUrl: string
  /** 24 base64url characters — shown so the code can also be pasted into the bot by hand, e.g.
   * when Telegram is only installed on another device. */
  code: string
  expiresAtUtc: string
}

/** Is a Telegram chat currently bound to this account, and which one. */
export function getTelegramStatus(): Promise<TelegramLinkStatusModel> {
  return authFetch<TelegramLinkStatusModel>('api/Account/Telegram')
}

/**
 * Issue a fresh one-time link code.
 *
 * POST, and deliberately NOT idempotent: every call mints a new code and invalidates the previous
 * one, so it must only ever run from an explicit user action — never from an effect or a retry.
 *
 * Answers 503 / `TelegramNotConfigured` (2219) when the server has no bot token: the visitor would
 * otherwise be handed a dead link and left waiting for a bot that cannot reply.
 */
export function issueTelegramLinkCode(): Promise<TelegramLinkCodeModel> {
  return authFetch<TelegramLinkCodeModel>('api/Account/Telegram/LinkCode', { method: 'POST' })
}

/** Unbind the chat. `204 No Content` — `apiFetch` tolerates the empty body. */
export function unlinkTelegram(): Promise<void> {
  return authFetch<void>('api/Account/Telegram', { method: 'DELETE' })
}
