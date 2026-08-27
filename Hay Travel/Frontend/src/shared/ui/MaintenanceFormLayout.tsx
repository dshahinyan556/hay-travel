import type { ReactNode } from 'react'

export interface MaintenanceFormLayoutProps {
  /** Same rule as `DataEntryScreenLayout`'s: only present when this screen is nested inside
   * another (rare for this template — most maintenance screens are root-level). */
  breadcrumbs?: ReactNode
  breadcrumbsLabel?: string
  title: ReactNode
  subtitle?: ReactNode
  /**
   * Search + result count + "Add" button (proposal `admin-page-templates.html` §B, pins 1–2) — the
   * one thing this archetype's control zone is built from: exactly one filled button ("Add"),
   * always last. No page-level Save/Delete/Cancel here at all — a maintenance screen never
   * accumulates a page-wide draft, each record is edited on its own (in a side panel/modal the
   * calling page owns), so there is nothing for a toolbar-style Save to commit.
   */
  controlZone?: ReactNode
  /** Error / success banners — lives here, above the table, not inside a specific row (proposal:
   * "строка может уехать из-за поиска, а сообщение должно остаться"). */
  message?: ReactNode
  /** The table (desktop) / card list (`<sm`) of independent, unlinked records. */
  children: ReactNode
  /**
   * Explanatory text under the table, not a hover tooltip (proposal pin §B.4 — e.g. drag-to-
   * reorder). Optional: most maintenance screens don't need one.
   */
  footnote?: ReactNode
  className?: string
}

/**
 * Template B — "Форма обслуживания" (designer proposal `admin-page-templates.html` §B). A set of
 * independent, unlinked records with no "main" one — free create, free delete, edited one at a
 * time. No existing screen implements this shell yet (Catalog/Products/Users/Roles list screens
 * still hand-roll their own header); those adopt it in a later phase, not part of this change.
 */
export function MaintenanceFormLayout({
  breadcrumbs,
  breadcrumbsLabel,
  title,
  subtitle,
  controlZone,
  message,
  children,
  footnote,
  className = '',
}: MaintenanceFormLayoutProps) {
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

      {controlZone && <div className="flex flex-wrap items-center gap-3">{controlZone}</div>}

      {message && <div className="flex flex-col gap-2">{message}</div>}

      {children}

      {footnote && <p className="text-xs text-neutral-500">{footnote}</p>}
    </div>
  )
}
