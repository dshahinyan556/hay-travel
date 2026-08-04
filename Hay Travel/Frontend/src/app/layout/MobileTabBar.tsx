import { NavLink } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { useAuth } from '@/shared/auth'
import { CompassIcon, GuideIcon, HomeIcon, MapIcon } from '@/shared/ui/icons'

/**
 * Fixed bottom tab bar — the mobile site's primary navigation (2026-08 restyle, floating-capsule
 * pass). Replaces the old hamburger + slide-down sheet: a thumb-reachable icon bar at 375px reads
 * far closer to the native app chrome the client referenced (Instagram/Telegram) than a menu
 * button hiding the links.
 *
 * Styled as the same floating capsule as `Header` (rounded-full, `bg-panel/90` + blur, matching
 * border/shadow) rather than the old edge-to-edge bar, so the two read as one design language
 * instead of a polished top bar and a flat strip at the bottom. The active tab gets a solid
 * `bg-gold-fill` chip behind its icon (not just a soft tint) — the client asked for the active tab
 * to stand out the way it does in Instagram/Telegram's own bottom bars.
 *
 * Rendered as a sibling of `Header` in `RootLayout`, not inside it — it is fixed to the viewport
 * rather than the page's scroll position, and `Header` only carries the desktop capsule nav
 * (`lg:flex`). `lg:hidden` here keeps the two mutually exclusive.
 */
export function MobileTabBar() {
  const { t } = useLocale()
  const { user } = useAuth()

  const tabItems = [
    { to: '/', label: t('nav.home'), end: true, Icon: HomeIcon },
    { to: '/trips', label: t('nav.trips'), end: false, Icon: CompassIcon },
    { to: '/regions', label: t('nav.regionsShort'), end: false, Icon: MapIcon },
    // One tab, two labels — `/auth` already renders either the sign-in tabs or the account panel,
    // so a fifth tab (or a second destination) would only duplicate that branch in the nav. `end`
    // stays false so the tab also reads as active on `/auth/change-password` & co.
    { to: '/auth', label: user ? t('nav.account') : t('nav.login'), end: false, Icon: GuideIcon },
  ] as const

  return (
    <nav
      aria-label={t('nav.mainAriaLabel')}
      className="fixed inset-x-3 z-30 lg:hidden"
      style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto flex w-full max-w-md items-center justify-between gap-1 rounded-full border border-edge/70 bg-panel/90 px-2 py-2 shadow-lg shadow-black/20 backdrop-blur-md">
        {tabItems.map(({ to, label, end, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className="flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-[11px] transition-colors duration-[var(--dur-micro)]"
          >
            {({ isActive }) => (
              <>
                <span
                  className={[
                    'flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-[var(--dur-micro)]',
                    isActive ? 'bg-gold-fill text-gold-on' : 'text-ink-muted',
                  ].join(' ')}
                >
                  <Icon size={19} />
                </span>
                <span
                  className={isActive ? 'font-semibold text-gold-ink' : 'text-ink-muted'}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
