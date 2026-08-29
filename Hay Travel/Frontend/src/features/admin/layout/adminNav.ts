/**
 * The single place where an admin screen's permission key, route, caption and glyph meet.
 *
 * It used to be a private array inside `AdminSidebar`. It moved out because there is a second
 * consumer: `firstVisibleAdminPath()`, which decides where to send somebody whose role cannot see
 * the dashboard. Two readers of the same list means the list is a module, not a component detail.
 *
 * Adding a screen after the flexible-roles migration is meant to be mechanical (checklist
 * requirement 11): one entry here, one key in `shared/auth/screens.ts`, one route in
 * `app/router.tsx`. Nothing in the permission core changes.
 */

import {
  CATALOG_SCREEN_KEYS,
  canViewAny,
  AdminScreen,
  type KnownScreenKey,
} from '@/shared/auth'
import type { adminLayoutCopy } from './adminLayoutCopy'

type NavCopy = ReturnType<typeof adminLayoutCopy>['nav']

export interface AdminNavItem {
  to: string
  /** Visible when AT LEAST ONE of these keys is viewable. `/admin/catalog` is one route over five. */
  screens: readonly KnownScreenKey[]
  /** Which caption of `adminLayoutCopy.nav` names this section. A KEY, not a string: the label is
   * resolved at render time, so switching the language re-labels the rail immediately — a
   * module-scope literal would be frozen at import time (ADR 021). */
  labelKey: keyof NavCopy
  /** Glyph shown before the label. Plain text, so no icon dependency is needed. */
  icon: string
  /** Match the URL exactly (used for the index route so it isn't active on children). */
  end?: boolean
}

/** Order is "daily work → rare configuration", which is why «Настройки» sits last. It is also the
 * order `firstVisibleAdminPath()` searches, so it doubles as a landing-page preference.
 *
 * `/admin/roles` and `/admin/notifications` are ordinary matrix screens like everything else here
 * (решение Давида 2026-08-22): no role, including the seeded «Администратор», is hard-wired to see
 * them — a role earns the row by having `roles`/`notifications` checked in its own matrix. */
export const adminNavItems: readonly AdminNavItem[] = [
  { to: '/admin', labelKey: 'dashboard', icon: '▦', end: true, screens: [AdminScreen.Dashboard] },
  { to: '/admin/products', labelKey: 'products', icon: '🧳', screens: [AdminScreen.Products] },
  { to: '/admin/calendar', labelKey: 'calendar', icon: '📅', screens: [AdminScreen.Calendar] },
  { to: '/admin/orders', labelKey: 'orders', icon: '🧾', screens: [AdminScreen.Orders] },
  { to: '/admin/catalog', labelKey: 'catalog', icon: '📚', screens: CATALOG_SCREEN_KEYS },
  { to: '/admin/users', labelKey: 'users', icon: '👤', screens: [AdminScreen.Users] },
  { to: '/admin/roles', labelKey: 'roles', icon: '🛡', screens: [AdminScreen.Roles] },
  { to: '/admin/notifications', labelKey: 'notifications', icon: '✉', screens: [AdminScreen.Notifications] },
  { to: '/admin/jobs', labelKey: 'jobs', icon: '⏱', screens: [AdminScreen.Jobs] },
  { to: '/admin/settings', labelKey: 'settings', icon: '⚙', screens: [AdminScreen.Settings] },
]

/**
 * Should this entry be rendered for the signed-in user?
 *
 * Hiding is UX, not security: the matching loader re-checks the same predicate and the backend
 * rejects the request regardless.
 */
export function isNavItemVisible(item: AdminNavItem): boolean {
  return canViewAny(item.screens)
}

/**
 * The first route this user can actually open, in sidebar order — or `null` when nothing is
 * visible at all (in which case `adminRootLoader` has already decided to render
 * `AdminAccessDenied`, so nobody will look at a route).
 *
 * Used by the dashboard: a role without `dashboard.View` must land SOMEWHERE, and the index route
 * cannot redirect to itself.
 */
export function firstVisibleAdminPath(): string | null {
  return adminNavItems.find(isNavItemVisible)?.to ?? null
}
