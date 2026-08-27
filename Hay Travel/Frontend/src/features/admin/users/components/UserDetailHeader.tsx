import type { UserDetailInfoModel } from '@/shared/auth'
import { Card } from '@/shared/ui'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { useCopy } from '@/shared/i18n/defineCopy'
import { onlineStatusFrom, type OnlineStatus } from '../lib/onlineStatus'
import { userCopy, type UserCopy } from '../lib/userCopy'

interface UserDetailHeaderProps {
  user: UserDetailInfoModel
}

/** Two letters for the avatar circle — first/last name initials, falling back to the first two
 * letters of the username when there is no last name (mirrors how `UsersTable` already falls back
 * to `username` for the accessible role label). */
function initialsOf(user: UserDetailInfoModel): string {
  const first = user.firstName.trim().charAt(0)
  const last = (user.lastName ?? '').trim().charAt(0)
  const initials = `${first}${last}`.trim()
  return (initials || user.username.slice(0, 2)).toUpperCase()
}

function OnlineBadge({ status }: { status: OnlineStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        status.isOnline ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-500'
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${status.isOnline ? 'bg-white' : 'bg-neutral-300'}`}
      />
      {status.label}
    </span>
  )
}

/** Verified/locked badges — same copy and colour tokens as `UsersTable`'s own `StatusBadges`
 * (kept as a small, deliberate duplication rather than a cross-file export: this component and
 * the table row are the only two places that need it, and the architecture note does not call for
 * a shared badge component). */
function AccountBadges({ user, copy }: { user: UserDetailInfoModel; copy: UserCopy['status'] }) {
  return (
    <>
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          user.isEmailVerified ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700 border border-dashed border-neutral-300'
        }`}
      >
        {user.isEmailVerified ? copy.verified : copy.unverified}
      </span>
      {user.isLocked && (
        <span
          className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700"
          title={copy.lockedTitle}
        >
          {copy.locked}
        </span>
      )}
    </>
  )
}

/**
 * The record-identity card of the user-detail screen — Template A's «карточка личности записи»
 * (`admin-page-templates.html` §A, pin 5): avatar + name + handle + the status badges, and nothing
 * that acts.
 *
 * It used to be the whole page header. The breadcrumb, the `<h1>` and the `HelpButton` moved OUT
 * to `UserDetailPage`'s `DataEntryScreenLayout` slots when the screen was retrofitted to that
 * template — every screen of this kind now gets that chrome from one place instead of hand-rolling
 * it. The name repeating between the page title and this card is the template's own shape, not an
 * oversight: the title says which record is open, the card is the record's own first field.
 *
 * Deliberately does NOT render a role picker (the mockup's `u-role-slot` did) — role changes stay
 * the sole responsibility of `RoleSelect`/`UsersTable`, per the F4 architecture note's point 6: "ни
 * на UserDetailPage, ни где-либо ещё смена роли не дублируется". Role is shown read-only instead,
 * in `UserDetailInfo`'s "Аккаунт" card.
 */
export function UserDetailHeader({ user }: UserDetailHeaderProps) {
  const { locale } = useLocale()
  const copy = useCopy(userCopy)

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username
  const status = onlineStatusFrom(copy.online, locale, user.lastActiveAtUtc)

  return (
    <Card padding="sm" className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-sm font-bold text-white"
        >
          {initialsOf(user)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-neutral-900">{fullName}</p>
          <p className="truncate text-sm text-neutral-500">
            @{user.username} · {user.email}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <OnlineBadge status={status} />
        <AccountBadges user={user} copy={copy.status} />
      </div>
    </Card>
  )
}
