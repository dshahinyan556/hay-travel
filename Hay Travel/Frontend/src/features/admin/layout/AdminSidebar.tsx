import { useMemo, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router'
import { useCopy } from '@/shared/i18n/defineCopy'
import { AdminLanguageSwitch } from './AdminLanguageSwitch'
import { adminLayoutCopy } from './adminLayoutCopy'
import { adminNavItems, isNavItemVisible } from './adminNav'
import { logout, usePermissions, type AuthUser } from '@/shared/auth'

const linkClass = ({ isActive }: { isActive: boolean }): string =>
  `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-white text-neutral-950' : 'text-slate-300 hover:bg-white/5 hover:text-white'
  }`

interface AdminSidebarProps {
  /** The signed-in staff member — drives both the nav filtering and the account block. */
  user: AuthUser
  /** Called after a nav link is clicked — lets the mobile drawer close itself on navigation. */
  onNavigate?: () => void
}

/**
 * The panel's dark navigation column (#0b1220): brand block, the permission-filtered nav, and an
 * account block pinned to the bottom (who is signed in, back to the public site, sign out).
 * Layout-agnostic — it fills its parent (`h-full`). `AdminLayout` renders it twice: as a fixed
 * rail on desktop and inside the slide-in drawer on mobile.
 *
 * The nav list itself lives in `adminNav.ts` — it has a second consumer (`firstVisibleAdminPath`)
 * and is therefore a module, not a component detail.
 */
export function AdminSidebar({ user, onNavigate }: AdminSidebarProps) {
  const navigate = useNavigate()
  const copy = useCopy(adminLayoutCopy)
  const [isLeaving, setIsLeaving] = useState(false)

  // Subscribes to the permission store so the rail re-filters itself when the matrix is refetched
  // (token rotation, or this admin editing their own role) — `isNavItemVisible` reads the snapshot
  // synchronously and would otherwise never re-run.
  const permissions = usePermissions()
  const visibleItems = useMemo(
    () => adminNavItems.filter(isNavItemVisible),
    // `permissions` is not read directly — it IS the dependency: the filter's answer is a function
    // of the snapshot, which is referentially stable until the set actually changes.
    [permissions],
  )

  async function handleLogout() {
    setIsLeaving(true)
    try {
      await logout()
      // `replace` so Back doesn't return to a panel page that would just bounce to /auth.
      navigate('/auth', { replace: true })
    } finally {
      setIsLeaving(false)
    }
  }

  return (
    <div className="flex h-full w-full flex-col gap-1 bg-[#0b1220] p-3 text-slate-300">
      <div className="mb-3 flex shrink-0 items-center gap-2.5 border-b border-white/10 px-2 pb-4 pt-1.5">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-sm font-bold text-neutral-950"
        >
          H
        </span>
        <div className="leading-tight">
          <div className="text-sm font-bold text-white">Hay Travel</div>
          <div className="text-xs text-slate-400">{copy.brandSubtitle}</div>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {visibleItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={onNavigate} className={linkClass}>
            <span aria-hidden="true" className="w-4 text-center opacity-85">
              {item.icon}
            </span>
            <span className="whitespace-nowrap">{copy.nav[item.labelKey]}</span>
          </NavLink>
        ))}
      </nav>

      {/* Account block — `mt-auto` pins it to the bottom of the rail/drawer. */}
      <div className="mt-auto flex flex-col gap-0.5 border-t border-white/10 pt-3">
        <div className="px-2.5 pb-1.5">
          <div className="truncate text-sm font-semibold text-white" title={user.username}>
            {user.username}
          </div>
          <div className="truncate text-xs text-slate-400" title={user.email}>
            {user.email}
          </div>
        </div>
        {/* Desktop only: on mobile the rail is a drawer and the switch already sits in the top
            bar, which is the panel's header there — two copies would just disagree visually. */}
        <AdminLanguageSwitch className="mb-1 hidden self-start md:flex" />
        <Link
          to="/"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
        >
          <span aria-hidden="true" className="w-4 text-center opacity-85">
            ←
          </span>
          <span className="whitespace-nowrap">{copy.backToSite}</span>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLeaving}
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span aria-hidden="true" className="w-4 text-center opacity-85">
            ⎋
          </span>
          <span className="whitespace-nowrap">{isLeaving ? copy.logoutPending : copy.logout}</span>
        </button>
      </div>
    </div>
  )
}
