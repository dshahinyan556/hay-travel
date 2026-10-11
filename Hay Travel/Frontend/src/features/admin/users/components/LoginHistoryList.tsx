import type { LoginHistoryEntryModel } from '@/shared/auth'
import { countryFlagEmoji, countryDisplayName } from '@/shared/lib/country'
import { formatUtcDateTime } from '@/shared/lib/date'
import type { Locale } from '@/shared/lib/locale'
import { describeUserAgent } from '@/shared/lib/userAgent'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { useCopy } from '@/shared/i18n/defineCopy'
import { userCopy } from '../lib/userCopy'

interface LoginHistoryListProps {
  /** `null` when the history request failed — the profile card must still render (its own request
   * succeeded), so this renders an explanatory line instead of nothing. */
  entries: LoginHistoryEntryModel[] | null
}

/** The server caps the response at 100 rows; the footnote is only honest when we are actually at
 * the cap, so it is conditional rather than always printed. */
const SERVER_LIMIT = 100

/**
 * Login history for one account (C2, 2026-08-09) — admin-only by explicit product decision; the
 * public `/account` screen deliberately does not show it.
 *
 * ── Why a stack of cards and not a table ──────────────────────────────────────────────────────
 * Four columns (time / place / IP / device) do not fit 375px, and the panel's other table
 * (`UsersTable`) already pays for that with a horizontal scrollbar and a `min-w-[860px]`. Here the
 * data is naturally one record per "event", so each row is its own small card: the timestamp leads,
 * the rest wraps underneath. It reads the same on a phone and on a desktop, with no second layout.
 *
 * Emoji flags are used on purpose — this is the ADMIN panel, whose icon language IS emoji (🗄 ↩ 🔍).
 * The public site is the one where emoji are banned as UI elements.
 *
 * The raw User-Agent is preserved in `title=`, because `describeUserAgent` is intentionally
 * approximate and an audit view must never be the place where information is lost.
 */
export function LoginHistoryList({ entries }: LoginHistoryListProps) {
  const { locale } = useLocale()
  const copy = useCopy(userCopy).history

  return (
    <section className="rounded-xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-neutral-800">{copy.title}</h2>
        <p className="text-xs text-neutral-500">{copy.subtitle}</p>
      </div>

      {entries === null ? (
        <p className="px-4 py-6 text-sm text-neutral-500">{copy.loadFailed}</p>
      ) : entries.length === 0 ? (
        <p className="px-4 py-6 text-sm text-neutral-500">{copy.empty}</p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-neutral-100">
            {entries.map((entry, index) => (
              <LoginHistoryRow key={`${entry.loggedInAtUtc}-${index}`} entry={entry} locale={locale} />
            ))}
          </ul>
          {entries.length === SERVER_LIMIT && (
            <p className="border-t border-neutral-100 px-4 py-2.5 text-[11px] text-neutral-500">
              {copy.limitNote(SERVER_LIMIT)}
            </p>
          )}
        </>
      )}
    </section>
  )
}

function LoginHistoryRow({ entry, locale }: { entry: LoginHistoryEntryModel; locale: Locale }) {
  const device = describeUserAgent(entry.userAgent)
  const place = formatPlace(entry, locale)

  return (
    <li className="flex flex-col gap-1 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-semibold text-neutral-900">
          {formatUtcDateTime(entry.loggedInAtUtc, locale)}
        </span>
        {place && <span className="text-sm text-neutral-600">{place}</span>}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-xs text-neutral-500">
        <span className="font-mono tabular-nums">{entry.ipAddress}</span>
        {/* `min-w-0` is what lets `truncate` actually clip inside a flex row — without it the item
            keeps its intrinsic width and pushes the card wide at 375px. */}
        {device && (
          <span className="min-w-0 truncate" title={entry.userAgent}>
            {device}
          </span>
        )}
      </div>
    </li>
  )
}

/** «🇦🇲 Армения, Ереван» — degrades gracefully: geo data is optional on the backend, so any part of
 * it can be missing and the row must still read correctly. `countryName` is the backend's own
 * fallback string and is not localised — it is only used when the ISO code is missing. */
function formatPlace(entry: LoginHistoryEntryModel, locale: Locale): string | null {
  const country = entry.countryCode
    ? `${countryFlagEmoji(entry.countryCode)} ${countryDisplayName(entry.countryCode, locale)}`
    : entry.countryName
  if (!country) return entry.city ?? null
  return entry.city ? `${country}, ${entry.city}` : country
}
