import { useEffect, useLayoutEffect, useState } from 'react'
import { Outlet, ScrollRestoration, useLoaderData, useLocation } from 'react-router'
import { useCopy } from '@/shared/i18n/defineCopy'
import { AdminSidebar } from './AdminSidebar'
import { AdminAccessDenied } from './AdminAccessDenied'
import { AdminLanguageSwitch } from './AdminLanguageSwitch'
import { adminLayoutCopy } from './adminLayoutCopy'
import type { adminRootLoader } from './adminRootLoader'

/**
 * Shell for the whole `/admin` tree.
 *
 * The route's loader has already resolved the session (`adminRootLoader`), so by the time this
 * renders the visitor is either staff — and gets the shell — or a signed-in customer, who gets
 * the refusal screen instead of an empty panel.
 *
 * Desktop (`md+`): a two-pane layout — a persistent dark `AdminSidebar` rail on the left, the
 * light work area (`<Outlet />`) on the right.
 *
 * Mobile: the rail would crush the work area, so instead there's a slim top bar with a
 * hamburger button that slides the same `AdminSidebar` in as an overlay drawer. The drawer
 * closes on backdrop click, on nav, and whenever the route changes. Body scroll is locked while
 * it's open. Deliberately has NO public Header/Footer — the panel is a self-contained tool.
 */
export function AdminLayout() {
  const { accessDenied, user } = useLoaderData<typeof adminRootLoader>()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const copy = useCopy(adminLayoutCopy)

  // Close the drawer on any navigation (covers links that keep the same pathname pattern).
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.key])

  // `/admin` is always light, regardless of the public site's stored dark/light preference — see
  // the identical guard in `index.html`'s pre-paint script for why. That inline script only runs
  // once, on the very first document load: it does NOT re-run on an in-app (`react-router`) nav
  // from the public site into `/admin`, so a visitor who arrives here via a client-side link while
  // `data-theme='dark'` is already set needs this effect to correct it on mount — `useLayoutEffect`
  // (not `useEffect`) so it lands before the browser paints this layout, avoiding a one-frame flash
  // of the dark palette on that nav. The `storage` listener is defense-in-depth beyond that —
  // nothing in `/admin` today reacts to another tab's theme change (`ThemeToggle`/`useTheme` only
  // mount inside the public `Header`), but if that ever changes, this keeps `/admin` pinned to
  // light for as long as this layout stays mounted instead of silently drifting dark. Deliberately
  // does not restore the public theme on unmount: leaving `/admin` remounts `RootLayout` →
  // `useSiteDesign`, whose own `useLayoutEffect` puts the cached preset back before the frame,
  // and `Header` → `useTheme`, which re-applies the stored preference.
  //
  // `data-preset` (Spec 006 / ADR 018) is stripped here for exactly the same reason and in the
  // same two places: the pre-paint script runs once per document load and does NOT re-run on a
  // client-side nav from the public site into `/admin`, so without this the admin panel would
  // render in basalt's colours. `/admin` is built on `brand-*` teal and white surfaces and must
  // never carry a preset, whichever palette the admin has chosen for the public site.
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = 'light'
    delete document.documentElement.dataset.preset
    function forceLight() {
      document.documentElement.dataset.theme = 'light'
      delete document.documentElement.dataset.preset
    }
    window.addEventListener('storage', forceLight)
    return () => window.removeEventListener('storage', forceLight)
  }, [])

  // Lock background scroll while the drawer is open.
  useEffect(() => {
    if (!drawerOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [drawerOpen])

  if (accessDenied) return <AdminAccessDenied user={user} />

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 text-neutral-800 md:flex-row">
      {/* Desktop rail */}
      <aside className="hidden w-60 shrink-0 md:block">
        <div className="sticky top-0 h-screen overflow-y-auto">
          <AdminSidebar user={user} />
        </div>
      </aside>

      {/* Mobile top bar with hamburger */}
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-[#0b1220] px-4 py-3 text-white md:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label={copy.openMenu}
          aria-expanded={drawerOpen}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-200 transition-colors hover:bg-white/10"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-xs font-bold text-neutral-950"
          >
            H
          </span>
          <span className="truncate text-sm font-bold">Hay Travel</span>
        </div>
        {/* On mobile this bar IS the panel's header, so the language switch lives here rather than
            in the drawer — `ml-auto` pins it to the right edge, `shrink-0` keeps the brand from
            pushing it out at 360px. */}
        <AdminLanguageSwitch className="ml-auto shrink-0" />
      </header>

      {/* Mobile drawer (always mounted so it can slide; inert when closed) */}
      <div className={`fixed inset-0 z-40 md:hidden ${drawerOpen ? '' : 'pointer-events-none'}`}>
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          aria-label={copy.closeMenu}
          tabIndex={drawerOpen ? 0 : -1}
          className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
            drawerOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={copy.menuLabel}
          className="absolute inset-y-0 left-0 w-72 max-w-[82%] shadow-2xl transition-transform duration-200"
          style={{ transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)' }}
        >
          <AdminSidebar user={user} onNavigate={() => setDrawerOpen(false)} />
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label={copy.closeMenu}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6">
        <Outlet />
      </main>
      <ScrollRestoration />
    </div>
  )
}
