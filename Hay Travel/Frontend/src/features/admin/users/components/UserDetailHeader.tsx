import { Link } from 'react-router'
import type { UserDetailInfoModel } from '@/shared/auth'
import { HelpButton } from '@/shared/ui/HelpButton'
import { onlineStatusFrom, type OnlineStatus } from '../lib/onlineStatus'
import { userDetailCopy } from '../lib/userCopy'

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
        status.isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${status.isOnline ? 'bg-emerald-500' : 'bg-neutral-300'}`}
      />
      {status.label}
    </span>
  )
}

/** Verified/locked badges — same copy and colour tokens as `UsersTable`'s own `StatusBadges`
 * (kept as a small, deliberate duplication rather than a cross-file export: this component and
 * the table row are the only two places that need it, and the architecture note does not call for
 * a shared badge component). */
function AccountBadges({ user }: { user: UserDetailInfoModel }) {
  return (
    <>
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          user.isEmailVerified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
        }`}
      >
        {user.isEmailVerified ? 'Подтверждён' : 'Не подтверждён'}
      </span>
      {user.isLocked && (
        <span
          className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700"
          title="Временная блокировка после неудачных попыток входа"
        >
          Заблокирован
        </span>
      )}
    </>
  )
}

/**
 * Shell of the user-detail screen (F4): breadcrumb back to the list, avatar + name + handle,
 * status badges (online/verified/locked), and the page's `HelpButton` — placed next to the
 * heading rather than in a shared `AdminPageHeader`, per the F14 architecture note (only one page
 * needs it so far).
 *
 * Deliberately does NOT render a role picker (the mockup's `u-role-slot` did) — role changes stay
 * the sole responsibility of `RoleSelect`/`UsersTable`, per the F4 architecture note's point 6: "ни
 * на UserDetailPage, ни где-либо ещё смена роли не дублируется". Role is shown read-only instead,
 * in `UserDetailInfo`'s "Аккаунт" card.
 */
export function UserDetailHeader({ user }: UserDetailHeaderProps) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username
  const status = onlineStatusFrom(user.lastActiveAtUtc)

  return (
    <header className="flex flex-col gap-3">
      <nav className="text-xs text-neutral-500" aria-label="Хлебные крошки">
        <Link to="/admin/users" className="transition-colors hover:text-neutral-800">
          Пользователи
        </Link>
        <span aria-hidden="true"> · </span>
        <span className="font-semibold text-neutral-800">{fullName}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-800"
          >
            {initialsOf(user)}
          </span>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">{fullName}</h1>
            <p className="text-sm text-neutral-500">
              @{user.username} · {user.email}
            </p>
          </div>
        </div>

        <HelpButton surface="admin" title={userDetailCopy.helpTitle}>
          {userDetailCopy.helpBody}
        </HelpButton>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <OnlineBadge status={status} />
        <AccountBadges user={user} />
      </div>
    </header>
  )
}
