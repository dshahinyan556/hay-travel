import { useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { canOpenAdminPanel, logout, useAuth } from '@/shared/auth'
import { useIsCompactViewport } from '@/shared/hooks'
import { GuideIcon } from '@/shared/ui/icons'
import { Popover } from '@/shared/ui'

/**
 * The header's account control, a sibling of `ThemeToggle`/`LanguageSwitch`.
 *
 * Anonymous → the same gold "Войти" pill the header always had, so nothing about the signed-out
 * header changes. Signed in → a trigger showing the username, opening a small menu (панель /
 * личный кабинет / выход).
 *
 * Desktop-only (`lg`), like the pill it replaces: below that the account entry lives in
 * `MobileTabBar`, which has the room for it.
 */
export function UserMenu() {
  const { t } = useLocale()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  // The trigger is `lg:` only (below that the account entry lives in `MobileTabBar`). Shrinking
  // the window with the menu open would leave the popover anchored to a `display:none` element —
  // measured as a zero rect and pinned to the top-left corner. Same breakpoint as the class, from
  // the shared hook, so the two cannot drift.
  const isCompact = useIsCompactViewport()
  const isOpen = open && !isCompact

  if (!user) {
    // Carry the current page so signing in returns here rather than dumping the visitor on `/`.
    const returnTo = `${location.pathname}${location.search}`
    const href = returnTo === '/' ? '/auth' : `/auth?returnTo=${encodeURIComponent(returnTo)}`
    return (
      <NavLink
        to={href}
        className="btn-motion hidden rounded-full bg-gold-fill px-4 py-1.5 text-sm font-medium text-gold-on hover:bg-gold-fill-hover lg:inline-block"
      >
        {t('nav.login')}
      </NavLink>
    )
  }

  async function handleLogout() {
    setIsLeaving(true)
    try {
      await logout()
      setOpen(false)
      navigate('/')
    } finally {
      setIsLeaving(false)
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={t('auth.accountMenu')}
        className="btn-motion hidden max-w-44 items-center gap-2 rounded-full px-3 py-1.5 text-sm text-ink-dim ring-1 ring-edge transition-colors hover:text-gold-ink lg:inline-flex"
      >
        <GuideIcon size={17} />
        <span className="truncate">{user.username}</span>
      </button>

      <Popover
        open={isOpen}
        onClose={() => setOpen(false)}
        anchorRef={triggerRef}
        className="w-56 overflow-hidden rounded-2xl border border-edge/70 bg-panel/95 p-1.5 shadow-lg shadow-black/30 backdrop-blur-md"
      >
        <div role="menu" aria-label={t('auth.accountMenu')} className="flex flex-col">
          <div className="truncate px-3 py-2 text-xs text-ink-muted" title={user.email}>
            {user.email}
          </div>
          {canOpenAdminPanel(user.role) && (
            <MenuLink to="/admin" onClick={() => setOpen(false)} label={t('auth.goToPanel')} />
          )}
          {/* One entry, not three: `/account` is where email, phone and password all live now. */}
          <MenuLink to="/account" onClick={() => setOpen(false)} label={t('account.title')} />
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            disabled={isLeaving}
            className="rounded-xl px-3 py-2 text-left text-sm text-ink-dim transition-colors hover:bg-wine-tint hover:text-gold-light disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('auth.logout')}
          </button>
        </div>
      </Popover>
    </>
  )
}

function MenuLink({ to, label, onClick }: { to: string; label: string; onClick: () => void }) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onClick}
      className="rounded-xl px-3 py-2 text-sm text-ink-dim transition-colors hover:bg-wine-tint hover:text-gold-light"
    >
      {label}
    </Link>
  )
}
