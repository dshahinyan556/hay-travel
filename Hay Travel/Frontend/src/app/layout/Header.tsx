import { useEffect, useState } from 'react'
import { NavLink } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { getLogoUrl } from '@/shared/api/siteSettings'
import { MountainIcon } from '@/shared/ui/icons'
import { ThemeToggle } from './ThemeToggle'
import { CurrencySwitch } from './CurrencySwitch'
import { LanguageSwitch } from './LanguageSwitch'
import { UserMenu } from './UserMenu'

/**
 * Public site header: a floating capsule nav, detached from the viewport edge on every side
 * (2026-08 restyle) rather than the old edge-to-edge bar — closer to the rounded, self-contained
 * chrome the client pointed to (Instagram/Telegram's own nav bars) than a flat strip, rendered in
 * Hay Travel's gold/wine instead of theirs.
 *
 * Primary links live here only from `lg` up. Below that they move to the fixed bottom
 * `MobileTabBar` (a sibling in `RootLayout`, not rendered here) — a pill this compact has no room
 * left for both a link row and the utility controls at 375px, so mobile keeps only brand +
 * currency/language/theme here and gets its primary navigation from the bottom bar instead.
 */
export function Header() {
  const { t } = useLocale()
  const navItems = [
    { to: '/', label: t('nav.home'), end: true },
    // One catalog entry: tours and excursions are tabs inside `/trips`, not separate sections.
    { to: '/trips', label: t('nav.trips') },
    { to: '/regions', label: t('nav.regions') },
  ]

  // Custom logo image, admin-set via `Настройки → Брендинг`. Fetched client-side (mounts on
  // every page, same pattern as `Footer`'s `getSocialLinks`) — an empty string means no image
  // was ever uploaded, which is an empty-state UI branch (the built-in wordmark below), not a
  // duplicated piece of site copy.
  const [logoUrl, setLogoUrl] = useState('')
  useEffect(() => {
    let cancelled = false
    getLogoUrl().then((url) => {
      if (!cancelled) setLogoUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <header
      className="sticky top-0 z-30 w-full px-3 pb-3 sm:px-4 sm:pb-4"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 rounded-full border border-edge/70 bg-panel/85 px-4 py-2.5 shadow-lg shadow-black/20 backdrop-blur-md sm:px-6">
        <NavLink to="/" className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt="Hay Travel" className="h-9 w-auto sm:h-11" />
          ) : (
            <>
              <span className="text-gold-ink">
                <MountainIcon size={22} />
              </span>
              {/*
                Always visible (2026-08-07): an earlier version hid this below `sm` to make room for
                `CurrencySwitch` at 375px — visible brand disappearing on mobile read as a bug, not a
                tradeoff, so it stays and shrinks instead. Utility-cluster gaps/padding were tightened
                to compensate (see below) rather than sacrificing the wordmark.
              */}
              <span className="text-gold-sheen font-display text-base leading-none tracking-wide sm:text-2xl">
                Hay Travel
              </span>
            </>
          )}
        </NavLink>

        {/* Each link draws a hairline under itself on hover/focus (2.4). */}
        <nav className="ml-6 hidden items-center gap-6 lg:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'text-sm',
                  'link-underline',
                  isActive ? 'text-accent-strong' : 'text-ink-dim hover:text-gold-ink',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {/*
            Currency first, and on EVERY viewport — no `lg:` gate. On a travel catalog "what does
            this cost in my money" is a higher-intent question than theme or language, and mobile is
            the majority of the traffic. It does NOT go in `MobileTabBar`: that bar's contract is
            four navigation destinations, and a stateful non-navigating control would break it.
          */}
          <CurrencySwitch />
          <LanguageSwitch />
          <ThemeToggle />
          {/* Renders the same gold "Войти" pill when signed out, an account dropdown when in. */}
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
