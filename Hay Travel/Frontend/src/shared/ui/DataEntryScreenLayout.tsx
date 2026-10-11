import type { ReactNode } from 'react'

export interface DataEntryScreenLayoutProps {
  /**
   * "Where this record was opened from" — per the header contract in the approved page-template
   * proposal (`admin-page-templates.html` §1), breadcrumbs exist ONLY when the screen is opened
   * "inside" another (a record inside its list). A root screen of this template omits the prop
   * entirely rather than render an empty row.
   */
  breadcrumbs?: ReactNode
  /** Accessible name of the breadcrumb `<nav>` — required together with `breadcrumbs`. */
  breadcrumbsLabel?: string
  /** 20px/800/neutral-900 — the same size on every screen of this template, never per-screen. */
  title: ReactNode
  /** 14px/neutral-500, one line: what this screen is and why it exists. */
  subtitle?: ReactNode
  /**
   * The control zone — `AdminToolbar` plus any contextual `AdminActionButton`s next to it (see
   * `OrderDetailPage`/`OrderContextActions`). This is the one part of the header contract that
   * actually differs between the five archetypes; every other slot on this component is identical
   * to `MaintenanceFormLayout`/`InquiryScreenLayout`'s own version of the same slot.
   */
  controlZone?: ReactNode
  /**
   * Error / success / record-state banners (e.g. "заказ ещё не одобрен"). Always rendered here,
   * directly under the control zone — never next to the specific control that triggered them
   * (proposal pin §A.4). A screen may pass more than one banner at once (a persistent record-state
   * notice plus a transient error) — this slot does not limit it to a single child.
   */
  message?: ReactNode
  /** Record card + summary panel, tabs, tab content — whatever the specific screen's body is
   * built from. This component has no opinion on the body's internal layout. */
  children: ReactNode
  className?: string
}

/**
 * Template A — "Экран ввода данных" (designer proposal `admin-page-templates.html` §A). Canon shape
 * extracted from `OrderDetailPage`/`OrderDetailView`, which remains the reference implementation
 * and keeps its own hand-rolled markup unchanged — this is only the reusable shell for the NEXT
 * screens of this kind (e.g. the user-detail and role-detail pages, a later phase). See
 * `docs/admin-panel.md`'s "Acumatica-style тулбар…" entry for the toolbar/summary primitives a
 * caller assembles into `controlZone`/`children`.
 *
 * Renders exactly the five-part header contract shared by all five archetypes (breadcrumbs → title
 * + subtitle → control zone → message slot → body). Nothing about Save/Cancel/tabs/draft state
 * lives here — that stays with the calling page (`AdminToolbar`, `Tabs`, its own draft reducer),
 * same "no business logic in a shared primitive" rule every other `shared/ui` piece follows.
 */
export function DataEntryScreenLayout({
  breadcrumbs,
  breadcrumbsLabel,
  title,
  subtitle,
  controlZone,
  message,
  children,
  className = '',
}: DataEntryScreenLayoutProps) {
  return (
    <div className={`mx-auto flex w-full max-w-6xl flex-col gap-4 ${className}`}>
      {breadcrumbs && (
        <nav className="text-xs text-neutral-500" aria-label={breadcrumbsLabel}>
          {breadcrumbs}
        </nav>
      )}

      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-neutral-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-neutral-500">{subtitle}</p>}
      </div>

      {/* Pinned below the mobile hamburger bar (60px) on phones, flush to the viewport top on
          desktop where that bar doesn't exist (`SetupFormLayout.controlZone` uses the same classes). Bleeds to `main`'s own edges (`-mx-4 sm:-mx-6`) so the background covers
          content scrolling underneath it — Save must stay reachable without scrolling back up on
          a long form (решение Давида 2026-08-31). */}
      {controlZone && (
        <div className="sticky top-[60px] z-10 -mx-4 flex flex-wrap items-center gap-3 bg-neutral-50 px-4 py-2 sm:-mx-6 sm:px-6 md:top-0">
          {controlZone}
        </div>
      )}

      {message && <div className="flex flex-col gap-2">{message}</div>}

      {children}
    </div>
  )
}
