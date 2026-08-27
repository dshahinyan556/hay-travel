import type { ReactNode } from 'react'

export interface InquiryScreenLayoutProps {
  breadcrumbs?: ReactNode
  breadcrumbsLabel?: string
  title: ReactNode
  subtitle?: ReactNode
  /**
   * Scope controls — period chips, a filter, "data as of HH:MM" + refresh (designer proposal
   * `admin-page-templates.html` §D, pins 1–2). These change what is SHOWN, never what is stored:
   * by definition this archetype has no control that mutates a record ("здесь ничего нельзя
   * сломать") — a caller that finds itself wiring a save/delete handler in here is building the
   * wrong template.
   */
  controlZone?: ReactNode
  /** Error / success banners — same slot position as every other archetype. A single failed block
   * should NOT take this slot down with it (proposal: "поломка одного блока не должна ронять всю
   * страницу") — surface a per-block retry inside `children` instead and reserve this for a
   * whole-screen failure. */
  message?: ReactNode
  /** Stat cards, "recent X" lists, whatever the specific dashboard/report is built from. */
  children: ReactNode
  className?: string
}

/**
 * Template D — "Экран просмотра" (designer proposal `admin-page-templates.html` §D). Read-only
 * display: whatever sits in `controlZone` only changes what is shown, nothing in it mutates data.
 * Per the classification table in the proposal, the Dashboard and the Orders LIST already behave
 * this way in the existing hand-rolled code — this is the shell for future screens of the same
 * shape, not a retrofit of either.
 */
export function InquiryScreenLayout({
  breadcrumbs,
  breadcrumbsLabel,
  title,
  subtitle,
  controlZone,
  message,
  children,
  className = '',
}: InquiryScreenLayoutProps) {
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
    </div>
  )
}
