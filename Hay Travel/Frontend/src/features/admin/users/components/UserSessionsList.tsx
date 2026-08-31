import { useState } from 'react'
import { revokeMyOtherSessions, revokeMySession, type SessionModel } from '@/shared/auth'
import { Button } from '@/shared/ui'
import { countryDisplayName, countryFlagEmoji } from '@/shared/lib/country'
import { formatUtcDateTime } from '@/shared/lib/date'
import type { Locale } from '@/shared/lib/locale'
import { describeUserAgent } from '@/shared/lib/userAgent'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { useCopy } from '@/shared/i18n/defineCopy'
import { revokeUserSession, revokeUserSessions } from '@/features/admin/api/adminUsers'
import { userCopy, usersErrorMessage, type UserCopy } from '../lib/userCopy'

interface UserSessionsListProps {
  userId: number
  /** `null` when the sessions request failed — the profile card must still render (its own request
   * succeeded), so this renders an explanatory line instead of nothing. Same contract as
   * `LoginHistoryList.entries`. */
  sessions: SessionModel[] | null
  /** `users.Update`, already narrowed by the page's SuperAdmin lock (`canEditUser`) — without it the
   * list is readable but carries no revoke controls, which is exactly what the backend enforces. */
  canRevoke: boolean
  /** Is the admin looking at their OWN profile? Then the self-service rules apply: the current row
   * keeps no revoke control, and the bulk action spares it. */
  isSelf: boolean
  /** Re-run the page's loader after a successful revoke — the same contract `UserPermissionsCard
   * .onSaved` uses. The list is server state; patching it locally here would be a second source of
   * truth for data the loader already owns. */
  onRevoked: () => void
}

/**
 * Live sessions of one account (spec 017 §4) — device, place, and a way to end them.
 *
 * Sits ABOVE `LoginHistoryList` on the profile: this is actionable current state, that is a
 * historical audit log, and the thing an admin came here to DO belongs higher than the thing they
 * came here to READ.
 *
 * ── Why it duplicates ~40 lines of that component's markup instead of sharing a row ─────────────
 * On purpose, and it is not an oversight: the same data is also shown to the visitor on `/account`,
 * in the public theme, where emoji are banned as UI elements. Here — the admin panel — emoji flags
 * ARE the icon language (see `LoginHistoryList`'s own note). One shared row component would have to
 * carry both visual languages behind a prop, which is a worse trade than two small lists. What IS
 * shared is the logic: the `SessionModel` type, `describeUserAgent`, and `formatUtcDateTime`.
 *
 * The visibility reasoning of the login history ("это для нас инфо", admin-only) deliberately does
 * NOT carry over: your own active sessions are yours to manage, and `/account` shows them.
 */
export function UserSessionsList({
  userId,
  sessions,
  canRevoke,
  isSelf,
  onRevoked,
}: UserSessionsListProps) {
  const { locale } = useLocale()
  const copy = useCopy(userCopy)
  const sessionCopy = copy.sessions

  /** Which row's button is spinning. An id rather than a boolean, so only the row being revoked is
   * disabled and the rest stay usable. `'all'` is the bulk action. */
  const [pendingId, setPendingId] = useState<number | 'all' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  /**
   * On the admin's OWN profile the current session is never offered for revocation — the same rule
   * `/account` follows.
   *
   * `isCurrent` is only ever `true` on rows that came from the SELF-SERVICE endpoint, which is
   * exactly what `userDetailLoader` calls for your own id; the admin endpoint reports `false` for
   * every row (it has no cookie of yours to compare against), so on somebody else's profile this
   * predicate is trivially true and every row keeps its button.
   */
  const isRevocable = (session: SessionModel) => !(isSelf && session.isCurrent)
  const hasRevocable = (sessions ?? []).some(isRevocable)

  async function revokeOne(session: SessionModel) {
    if (pendingId !== null) return
    setPendingId(session.id)
    setError(null)
    setNotice(null)
    try {
      // Own profile → the self-service endpoint. Not interchangeable with the admin one: this path
      // is also what an account WITHOUT `users.Update` would be entitled to, and it is the endpoint
      // whose ownership check is keyed on the token rather than on a route id.
      if (isSelf) await revokeMySession(session.id)
      else await revokeUserSession(userId, session.id)
      setNotice(sessionCopy.revokedOne)
      onRevoked()
    } catch (err) {
      setError(usersErrorMessage(copy, err, copy.errorActions.revokeSession))
    } finally {
      setPendingId(null)
    }
  }

  /**
   * Решено (David, 2026-08-29): «завершить все сеансы» не должно сносить собственную
   * impersonation-сессию вызывающего админа над этой же целью. Фронт про это ничего не знает
   * и знать не должен — щадит её сам `AuthService.RevokeAllUserSessionsAsync` (по
   * `ImpersonatedByUserId` строки против `actingUserId` из токена вызывающего), так что этот
   * компонент остаётся прежним что для isSelf, что для чужой карточки.
   */
  async function revokeAll() {
    if (pendingId !== null) return
    setPendingId('all')
    setError(null)
    setNotice(null)
    try {
      if (isSelf) await revokeMyOtherSessions()
      else await revokeUserSessions(userId)
      setNotice(isSelf ? sessionCopy.revokedOthers : sessionCopy.revokedAll)
      onRevoked()
    } catch (err) {
      setError(usersErrorMessage(copy, err, copy.errorActions.revokeSessions))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-neutral-100 px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-neutral-800">{sessionCopy.title}</h2>
          <p className="text-xs text-neutral-500">{sessionCopy.subtitle}</p>
        </div>
        {canRevoke && hasRevocable && (
          <Button
            variant="secondary"
            size="sm"
            disabled={pendingId !== null}
            onClick={() => void revokeAll()}
          >
            {pendingId === 'all'
              ? sessionCopy.revoking
              : isSelf
                ? sessionCopy.revokeOthers
                : sessionCopy.revokeAll}
          </Button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mx-4 mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {error}
        </div>
      )}
      {notice && !error && (
        <p
          role="status"
          className="mx-4 mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}

      {sessions === null ? (
        <p className="px-4 py-6 text-sm text-neutral-500">{sessionCopy.loadFailed}</p>
      ) : sessions.length === 0 ? (
        <p className="px-4 py-6 text-sm text-neutral-500">{sessionCopy.empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-100">
          {sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              locale={locale}
              copy={sessionCopy}
              // Revoked rows disappear on the next revalidation, so an id is a stable key and a
              // stable pending target.
              canRevoke={canRevoke && isRevocable(session)}
              showCurrentBadge={isSelf && session.isCurrent}
              pending={pendingId === session.id}
              disabled={pendingId !== null}
              onRevoke={() => void revokeOne(session)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function SessionRow({
  session,
  locale,
  copy,
  canRevoke,
  showCurrentBadge,
  pending,
  disabled,
  onRevoke,
}: {
  session: SessionModel
  locale: Locale
  copy: UserCopy['sessions']
  canRevoke: boolean
  showCurrentBadge: boolean
  pending: boolean
  disabled: boolean
  onRevoke: () => void
}) {
  const device = describeUserAgent(session.createdByUserAgent) ?? copy.unknownDevice
  const place = formatPlace(session, locale)

  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 py-3">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {/* The raw User-Agent stays in `title=` — `describeUserAgent` is intentionally
              approximate and must never be the place where information is lost. */}
          <span className="text-sm font-semibold text-neutral-900" title={session.createdByUserAgent ?? undefined}>
            {device}
          </span>
          {showCurrentBadge && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              {copy.current}
            </span>
          )}
          {place && <span className="text-sm text-neutral-600">{place}</span>}
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-xs text-neutral-500">
          <span className="font-mono tabular-nums">{session.createdByIp}</span>
          <span>{copy.signedInAt(formatUtcDateTime(session.createdAtUtc, locale))}</span>
          <span>{copy.expiresAt(formatUtcDateTime(session.expiresAtUtc, locale))}</span>
        </div>
      </div>

      {/* Absent, not disabled, on a row that must not be revoked: a permanently dead button next to
          "это устройство" would only invite the click it can never serve. */}
      {canRevoke && (
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled}
          aria-label={copy.revokeAria(device)}
          onClick={onRevoke}
        >
          {pending ? copy.revoking : copy.revoke}
        </Button>
      )}
    </li>
  )
}

/** «🇦🇲 Армения, Ереван» — identical rule to `LoginHistoryList.formatPlace`, including the emoji
 * flag, because this list lives on the same admin screen. Degrades gracefully: geo data is optional
 * on the backend, so any part of it can be missing and the row must still read correctly. */
function formatPlace(session: SessionModel, locale: Locale): string | null {
  const country = session.countryCode
    ? `${countryFlagEmoji(session.countryCode)} ${countryDisplayName(session.countryCode, locale)}`
    : session.countryName
  if (!country) return session.city ?? null
  return session.city ? `${country}, ${session.city}` : country
}
