/**
 * "Online now" approximation for the user-detail screen (F4), derived from
 * `UserDetailInfoModel.lastActiveAtUtc` — the account's most recent authenticated request,
 * written by the backend's B7 middleware.
 *
 * `ONLINE_THRESHOLD_MINUTES` MUST match B7's own throttle window (`admin-fixes-checklist-
 * 2026-08-06.txt`, B7: `LastActiveAtUtc == null || older than 5 minutes` gates the write). A
 * smaller number here would flag a genuinely active user "offline" for up to 5 minutes simply
 * because the backend hadn't re-written the timestamp yet — the two numbers are one contract,
 * not independently tunable.
 *
 * No polling/heartbeat (explicit product decision, same checklist entry: "без heartbeat/polling-
 * инфраструктуры") — this is evaluated once against whatever snapshot the loader fetched. The
 * detail page re-evaluates it only when the loader data itself is refreshed (revalidation), not on
 * a timer.
 */
import type { Locale } from '@/shared/lib/locale'

export const ONLINE_THRESHOLD_MINUTES = 5

export interface OnlineStatus {
  isOnline: boolean
  label: string
}

/** The three strings this module needs, structurally satisfied by `userCopy.online`. Declared here
 * rather than imported from the copy module so the dependency points one way only (copy knows
 * nothing about this file). */
export interface OnlineStatusCopy {
  online: string
  lastSeen: (relative: string) => string
  noActivity: string
}

/** One formatter per locale, built once: `Intl.RelativeTimeFormat` is not free to construct.
 * `en-GB` per Spec 009 §5 — the tag the whole panel uses for its English side. */
const RELATIVE_TIME: Record<Locale, Intl.RelativeTimeFormat> = {
  ru: new Intl.RelativeTimeFormat('ru', { numeric: 'auto' }),
  en: new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' }),
}

/** Coarsens a millisecond gap into the largest whole unit the copy reads naturally in — minutes
 * under an hour, hours under a day, days otherwise. */
function relativeLabel(diffMs: number, locale: Locale): string {
  const relativeTime = RELATIVE_TIME[locale]
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 60) return relativeTime.format(-minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return relativeTime.format(-hours, 'hour')
  const days = Math.round(hours / 24)
  return relativeTime.format(-days, 'day')
}

/**
 * Pure: both the wording and the locale come from the caller (Spec 009 §3), so this never reads
 * the stored locale itself.
 *
 * @param copy `userCopy(locale).online`.
 * @param locale Interface locale — drives the relative-time formatting, which `copy` cannot carry.
 * @param lastActiveAtUtc ISO-8601 UTC timestamp, or `null` if the account never made an
 *   authenticated request since the field was introduced (B2/B7).
 * @param nowMs Injectable for tests; defaults to the real clock.
 */
export function onlineStatusFrom(
  copy: OnlineStatusCopy,
  locale: Locale,
  lastActiveAtUtc: string | null,
  nowMs: number = Date.now(),
): OnlineStatus {
  if (!lastActiveAtUtc) return { isOnline: false, label: copy.noActivity }

  const diffMs = nowMs - new Date(lastActiveAtUtc).getTime()
  // <= 0 covers clock skew (server slightly ahead of the browser) — treated as online rather
  // than as a negative, nonsensical "in the future" relative label.
  if (diffMs <= ONLINE_THRESHOLD_MINUTES * 60_000) {
    return { isOnline: true, label: copy.online }
  }
  return { isOnline: false, label: copy.lastSeen(relativeLabel(diffMs, locale)) }
}
