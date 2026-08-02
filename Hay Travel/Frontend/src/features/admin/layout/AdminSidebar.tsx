import { NavLink } from 'react-router'

interface NavItem {
  to: string
  label: string
  /** Glyph shown before the label. Kept as plain text so no icon dependency is needed. */
  icon: string
  /** Match the URL exactly (used for the index route so it isn't active on children). */
  end?: boolean
}

/** Flat navigation — a handful of top-level sections. No group captions: with only a couple of
 * items the "Обзор"/"Создание" headers read as noise, not structure. Creating a product lives on
 * the Products page itself, not as a separate nav entry.
 *
 * Order is "daily work → rare configuration", which is why "Настройки" sits last. */
const navItems: NavItem[] = [
  { to: '/admin', label: 'Дашборд', icon: '▦', end: true },
  { to: '/admin/products', label: 'Продукты', icon: '🧳' },
  { to: '/admin/catalog', label: 'Справочники', icon: '📚' },
  { to: '/admin/settings', label: 'Настройки', icon: '⚙' },
]

const linkClass = ({ isActive }: { isActive: boolean }): string =>
  `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-brand-700 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
  }`

interface AdminSidebarProps {
  /** Called after a nav link is clicked — lets the mobile drawer close itself on navigation. */
  onNavigate?: () => void
}

/**
 * The panel's dark navigation column (#0b1220): brand block plus the flat nav. Purely
 * presentational and layout-agnostic — it fills its parent (`h-full`). `AdminLayout` renders it
 * twice: as a fixed rail on desktop and inside the slide-in drawer on mobile.
 */
export function AdminSidebar({ onNavigate }: AdminSidebarProps) {
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
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={onNavigate} className={linkClass}>
            <span aria-hidden="true" className="w-4 text-center opacity-85">
              {item.icon}
            </span>
            <span className="whitespace-nowrap">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
