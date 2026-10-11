import { useEffect, useState } from 'react'
import {
  getMySessions,
  revokeMyOtherSessions,
  revokeMySession,
  type SessionModel,
} from '@/shared/auth'
import { countryDisplayName } from '@/shared/lib/country'
import { formatUtcDateTime } from '@/shared/lib/date'
import type { Locale } from '@/shared/lib/locale'
import { describeUserAgent } from '@/shared/lib/userAgent'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { AuthError, AuthNotice } from '../../components/AuthShell'
import { accountErrorMessageKey } from '../lib/accountErrors'

/**
 * «Активные сеансы» — the visitor's own devices (spec 017 §4), with a way to end any of them.
 *
 * ── Why the list is NOT loaded by `accountLoader` ───────────────────────────────────────────────
 * Deliberate deviation from the screen's own pattern (the profile and the Telegram status ARE
 * loaded there). This section starts COLLAPSED, so a third blocking request in front of the first
 * paint would be paid by every visitor for a panel most of them never open. It is fetched on mount
 * instead — and `AccountSection` unmounts its children when closed, so re-opening refetches. That is
 * the right behaviour here rather than a cost: these are live capabilities, and a cached list could
 * offer to revoke a device that is already gone.
 *
 * ── What this component must never do ──────────────────────────────────────────────────────────
 * Sign the visitor out. The current session is never offered for revocation (the row simply has no
 * button — absent, not disabled), and `RevokeOthers` spares it server-side. If the visitor's own
 * session does die anyway — an admin revoked it from the panel — the global `authFetch` → 401 →
 * `SessionExpiredError` path already handles that for the whole app. Calling `logout()` or clearing
 * the store from here would duplicate and race with it.
 *
 * ── Why it duplicates the admin `UserSessionsList` markup ──────────────────────────────────────
 * Same data, two visual languages, on purpose: the panel uses emoji flags and `neutral-*` classes,
 * the public site uses the token palette and bans emoji as UI elements. Shared instead: the
 * `SessionModel` type, `describeUserAgent` and `formatUtcDateTime`.
 */
export function SessionsSection() {
  const { t, locale } = useLocale()

  const [sessions, setSessions] = useState<SessionModel[] | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  /** Which row's button is busy; `'others'` is the bulk action. One at a time — every one of these
   * mutates the same list. */
  const [pendingId, setPendingId] = useState<number | 'others' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  /** Bumped by the retry button to re-run the effect below. */
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadFailed(false)

    getMySessions()
      .then((result) => {
        if (cancelled) return
        setSessions(result)
      })
      .catch(() => {
        // No error CODE is useful here — a failed list is a failed list, and the visitor's only
        // action is to try again. The message is the section's own, not the shared error mapping.
        if (!cancelled) setLoadFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    // The section can be collapsed mid-flight; without this the resolve would set state on an
    // unmounted component and, worse, resurrect a list the visitor has already closed.
    return () => {
      cancelled = true
    }
  }, [attempt])

  async function revokeOne(session: SessionModel) {
    if (pendingId !== null) return
    setPendingId(session.id)
    setError(null)
    setNotice(null)
    try {
      await revokeMySession(session.id)
      // Local patch rather than a refetch: the server has just confirmed this row is gone, and a
      // second round trip would only make the row linger on screen.
      setSessions((prev) => (prev === null ? prev : prev.filter((item) => item.id !== session.id)))
      setNotice(t('account.sessionsRevokedOne'))
    } catch (err) {
      setError(t(accountErrorMessageKey(err)))
    } finally {
      setPendingId(null)
    }
  }

  async function revokeOthers() {
    if (pendingId !== null) return
    setPendingId('others')
    setError(null)
    setNotice(null)
    try {
      await revokeMyOtherSessions()
      // Everything except the current row is gone. `isCurrent` is the server's own answer about
      // which row that is — never a guess based on the user agent or the newest timestamp.
      setSessions((prev) => (prev === null ? prev : prev.filter((item) => item.isCurrent)))
      setNotice(t('account.sessionsRevokedOthers'))
    } catch (err) {
      setError(t(accountErrorMessageKey(err)))
    } finally {
      setPendingId(null)
    }
  }

  if (isLoading) {
    return <p className="text-sm text-ink-dim">{t('account.sessionsLoading')}</p>
  }

  if (loadFailed || sessions === null) {
    return (
      <div className="flex flex-col gap-3.5">
        <AuthError message={t('account.sessionsLoadFailed')} />
        <button
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
          className="w-full cursor-pointer rounded-full px-5 py-3 text-center text-sm text-ink-dim ring-1 ring-edge-strong transition-colors hover:text-gold-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
        >
          {t('account.sessionsRetry')}
        </button>
      </div>
    )
  }

  const others = sessions.filter((session) => !session.isCurrent)

  return (
    <div className="flex flex-col gap-3.5">
      {error && <AuthError message={error} />}
      {notice && !error && <AuthNotice message={notice} />}

      <p className="text-sm text-ink-dim">{t('account.sessionsIntro')}</p>

      <ul className="flex flex-col divide-y divide-edge">
        {sessions.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            locale={locale}
            pending={pendingId === session.id}
            disabled={pendingId !== null}
            onRevoke={() => void revokeOne(session)}
          />
        ))}
      </ul>

      {others.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('account.sessionsEmpty')}</p>
      ) : (
        <button
          type="button"
          onClick={() => void revokeOthers()}
          disabled={pendingId !== null}
          className="w-full cursor-pointer rounded-full px-5 py-3 text-center text-sm text-ink-dim ring-1 ring-edge-strong transition-colors hover:text-danger focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendingId === 'others'
            ? t('account.sessionsRevoking')
            : t('account.sessionsRevokeOthers')}
        </button>
      )}
    </div>
  )
}

function SessionRow({
  session,
  locale,
  pending,
  disabled,
  onRevoke,
}: {
  session: SessionModel
  locale: Locale
  pending: boolean
  disabled: boolean
  onRevoke: () => void
}) {
  const { t } = useLocale()
  const device = describeUserAgent(session.createdByUserAgent) ?? t('account.sessionsUnknownDevice')
  const place = formatPlace(session, locale)

  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          {/* The raw User-Agent stays reachable in `title=`: `describeUserAgent` is intentionally
              approximate, and "is this device mine?" is exactly the question this row must not
              answer with less information than it has. */}
          <span className="text-sm text-ink" title={session.createdByUserAgent ?? undefined}>
            {device}
          </span>
          {session.isCurrent && (
            <span className="rounded-full bg-gold-fill/15 px-2 py-0.5 text-[11px] font-medium text-gold-ink">
              {t('account.sessionsCurrent')}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-xs text-ink-muted">
          {/* No emoji flag here, unlike the admin list — plain localised country name: emoji are an
              admin-panel icon language and are banned as UI elements on the public site. */}
          {place && <span>{place}</span>}
          <span className="font-mono tabular-nums">{session.createdByIp}</span>
          <span>
            {t('account.sessionsSignedInAt', {
              moment: formatUtcDateTime(session.createdAtUtc, locale),
            })}
          </span>
          <span>
            {t('account.sessionsExpiresAt', {
              moment: formatUtcDateTime(session.expiresAtUtc, locale),
            })}
          </span>
        </div>
      </div>

      {/* The current session gets NO control at all — not a disabled one. There is no state in
          which ending the session you are sitting in from this list is the right outcome, and a
          greyed-out button would only ask the visitor to wonder why. */}
      {!session.isCurrent && (
        <button
          type="button"
          onClick={onRevoke}
          disabled={disabled}
          aria-label={t('account.sessionsRevokeAria', { device })}
          className="shrink-0 cursor-pointer rounded-full px-3.5 py-1.5 text-sm text-ink-dim ring-1 ring-edge-strong transition-colors hover:text-danger focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? t('account.sessionsRevoking') : t('account.sessionsRevoke')}
        </button>
      )}
    </li>
  )
}

/** «Армения, Ереван» — localised country name plus city, without the admin list's emoji flag.
 * Degrades gracefully: geo data is optional on the backend, so any part of it can be missing and the
 * row must still read correctly. `countryName` is the backend's own unlocalised fallback and is used
 * only when the ISO code is absent. */
function formatPlace(session: SessionModel, locale: Locale): string | null {
  const country = session.countryCode
    ? countryDisplayName(session.countryCode, locale)
    : session.countryName
  if (!country) return session.city ?? null
  return session.city ? `${country}, ${session.city}` : country
}
