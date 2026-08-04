import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router'
import {
  canManageCatalog,
  canManageSettings,
  canManageUsers,
  logout,
  type AuthUser,
  type RoleType,
} from '@/shared/auth'

interface NavItem {
  to: string
  label: string
  /** Glyph shown before the label. Kept as plain text so no icon dependency is needed. */
  icon: string
  /** Match the URL exactly (used for the index route so it isn't active on children). */
  end?: boolean
  /**
   * Whether this role may open the section. Omitted → visible to anyone who can open the panel
   * at all (`adminRootLoader` has already refused everyone else).
   *
   * Hiding is UX, not security: the matching loader re-checks the same predicate, and the backend
   * rejects the request regardless. A TourManager therefore sees only Дашборд + Продукты.
   */
  can?: (role: RoleType) => boolean
}

/** Flat navigation — a handful of top-level sections. No group captions: with only a couple of
 * items the "Обзор"/"Создание" headers read as noise, not structure. Creating a product lives on
 * the Products page itself, not as a separate nav entry.
 *
 * Order is "daily work → rare configuration", which is why "Настройки" sits last. */
const navItems: NavItem[] = [
  { to: '/admin', label: 'Дашборд', icon: '▦', end: true },
  { to: '/admin/products', label: 'Продукты', icon: '🧳' },
  { to: '/admin/catalog', label: 'Справочники', icon: '📚', can: canManageCatalog },
  { to: '/admin/users', label: 'Пользователи', icon: '👤', can: canManageUsers },
  { to: '/admin/settings', label: 'Настройки', icon: '⚙', can: canManageSettings },
]

const linkClass = ({ isActive }: { isActive: boolean }): string =>
  `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-brand-700 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
  }`

interface AdminSidebarProps {
  /** The signed-in staff member — drives both the nav filtering and the account block. */
  user: AuthUser
  /** Called after a nav link is clicked — lets the mobile drawer close itself on navigation. */
  onNavigate?: () => void
}

/**
 * The panel's dark navigation column (#0b1220): brand block, the role-filtered nav, and an
 * account block pinned to the bottom (who is signed in, back to the public site, sign out).
 * Layout-agnostic — it fills its parent (`h-full`). `AdminLayout` renders it twice: as a fixed
 * rail on desktop and inside the slide-in drawer on mobile.
 */
export function AdminSidebar({ user, onNavigate }: AdminSidebarProps) {
  const navigate = useNavigate()
  const [isLeaving, setIsLeaving] = useState(false)

  const visibleItems = navItems.filter((item) => !item.can || item.can(user.role))

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
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-brand-800 text-sm font-bold text-white"
        >
          H
        </span>
        <div className="leading-tight">
          <div className="text-sm font-bold text-white">Hay Travel</div>
          <div className="text-xs text-slate-400">Панель администратора</div>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {visibleItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={onNavigate} className={linkClass}>
            <span aria-hidden="true" className="w-4 text-center opacity-85">
              {item.icon}
            </span>
            <span className="whitespace-nowrap">{item.label}</span>
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
        <Link
          to="/"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
        >
          <span aria-hidden="true" className="w-4 text-center opacity-85">
            ←
          </span>
          <span className="whitespace-nowrap">На сайт</span>
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
          <span className="whitespace-nowrap">{isLeaving ? 'Выходим…' : 'Выйти'}</span>
        </button>
      </div>
    </div>
  )
}
