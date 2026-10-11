import type { ReactNode } from 'react'

export interface SetupFormLayoutProps {
  title: ReactNode
  subtitle?: ReactNode
  /**
   * The control zone — `AdminToolbar` (Отмена/Сохранить) plus whatever reads next to it (e.g. the
   * "N несохранённых изменений" counter). Pinned while scrolling exactly like
   * `DataEntryScreenLayout`'s control zone — same classes, so the two templates cannot drift apart.
   *
   * Replaced the bottom-pinned `footer` save bar (решение Давида 2026-10-11: Save на всех экранах
   * админки — в тулбаре сверху, как у заказа). Optional: a screen with nothing to save (e.g. the
   * server returned no settings at all) omits it rather than show a permanently dead toolbar.
   */
  controlZone?: ReactNode
  /**
   * The record-identity strip (designer proposal `admin-page-templates.html` §C, pin 1). Makes the
   * "exactly one record, forever" rule visible instead of merely enforced by routing. Conventionally
   * a name/label, a "единственная запись"-style badge and a last-modified note; this component owns
   * only the card chrome and position, the caller owns the content — no business copy is baked into
   * `shared/ui`, same rule `AdminSummaryPanel`'s plain `rows` prop already follows.
   *
   * Optional: the strip earns its place only when it says something the screen does not already
   * show. `/admin/settings` — the archetype's own example — drops it, because the section tabs sit
   * directly below and repeat the same count.
   */
  identity?: ReactNode
  /** Error / success banners for the save itself (e.g. "сервер не ответил"). */
  message?: ReactNode
  /** Tabs by field group + the field cards themselves. */
  children: ReactNode
  className?: string
}

/**
 * Template C — "Форма настройки" (designer proposal `admin-page-templates.html` §C). A frequency-
 * one special case of template B: exactly one record ever exists, and creating a second is
 * structurally impossible (no list route, no `/new`, no `/:id` — the screen itself IS the record).
 *
 * Header order is the shared contract: title + subtitle → pinned control zone → identity strip →
 * message slot → body. Add/Delete do not exist for this archetype, so its control zone carries
 * only Cancel/Save. No `breadcrumbs` prop: every existing example of this template
 * (`/admin/settings`) is a root screen, never opened "inside" another.
 */
export function SetupFormLayout({
  title,
  subtitle,
  controlZone,
  identity,
  message,
  children,
  className = '',
}: SetupFormLayoutProps) {
  return (
    <div className={`mx-auto flex w-full max-w-6xl flex-col gap-4 ${className}`}>
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-neutral-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-neutral-500">{subtitle}</p>}
      </div>

      {/* Same pinning as `DataEntryScreenLayout`: below the mobile hamburger bar (60px) on phones,
          flush to the viewport top on desktop; bleeds to `main`'s edges so content scrolling
          underneath it is covered. */}
      {controlZone && (
        <div className="sticky top-[60px] z-10 -mx-4 flex flex-wrap items-center gap-3 bg-neutral-50 px-4 py-2 sm:-mx-6 sm:px-6 md:top-0">
          {controlZone}
        </div>
      )}

      {identity && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
          {identity}
        </div>
      )}

      {message && <div className="flex flex-col gap-2">{message}</div>}

      {children}
    </div>
  )
}
