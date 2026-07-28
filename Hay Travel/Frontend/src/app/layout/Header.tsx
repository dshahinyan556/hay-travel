import { useState } from 'react'
import { NavLink } from 'react-router'
import { MenuIcon, CloseIcon, MountainIcon } from '@/shared/ui/icons'
import { ThemeToggle } from './ThemeToggle'
import { LanguageSwitch } from './LanguageSwitch'

const navItems = [
  { to: '/', label: 'Главная', end: true },
  // One catalog entry: tours and excursions are tabs inside `/trips`, not separate sections.
  { to: '/trips', label: 'Путешествия' },
  { to: '/regions', label: 'Карта регионов' },
]

/**
 * Public site header: transparent-ish sticky bar over the dark page.
 *
 * Mobile keeps the same nav behind a hamburger rather than shrinking the links — at 375px the
 * nav row plus language switch would not fit legibly. The sheet is rendered in-flow
 * under the bar (not fixed), so it pushes nothing and needs no scroll lock.
 */
export function Header() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 border-b border-edge bg-page/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-3.5 sm:px-6">
        <NavLink to="/" className="flex items-center gap-2" onClick={() => setMenuOpen(false)}>
          <span className="text-gold-ink">
            <MountainIcon size={22} />
          </span>
          <span className="text-gold-sheen font-display text-2xl leading-none font-semibold tracking-wide">
            Hay Travel
          </span>
        </NavLink>

        <nav className="ml-6 hidden items-center gap-6 lg:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'text-sm transition-colors',
                  isActive ? 'text-accent-strong' : 'text-ink-dim hover:text-gold-ink',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitch />
          <ThemeToggle />
          <NavLink
            to="/login"
            className="hidden rounded-full bg-gold-fill px-4 py-1.5 text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover sm:inline-block"
          >
            Войти
          </NavLink>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={menuOpen}
            // `before:-inset-0.5` grows the tap target to 44x44 CSS px on top of the visible
            // 40x40 circle instead of enlarging it — an invisible hit-area expander.
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-dim ring-1 ring-edge transition-colors before:absolute before:-inset-0.5 before:content-[''] hover:text-gold-ink lg:hidden"
          >
            {menuOpen ? <CloseIcon size={18} /> : <MenuIcon size={18} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-edge bg-panel px-4 py-3 lg:hidden">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                [
                  'block rounded-lg px-3 py-2.5 text-sm transition-colors',
                  isActive ? 'bg-accent-soft text-accent-strong' : 'text-ink-dim hover:text-gold-ink',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
          <NavLink
            to="/login"
            onClick={() => setMenuOpen(false)}
            className="mt-2 block rounded-lg bg-gold-fill px-3 py-2.5 text-center text-sm font-medium text-gold-on"
          >
            Войти
          </NavLink>
        </nav>
      )}
    </header>
  )
}
