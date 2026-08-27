import type { ReactNode } from 'react'

export interface SetupFormLayoutProps {
  title: ReactNode
  subtitle?: ReactNode
  /**
   * The record-identity strip (designer proposal `admin-page-templates.html` §C, pin 1 — the one
   * genuinely NEW element the whole proposal introduces). Makes the "exactly one record, forever"
   * rule visible instead of merely enforced by routing. Conventionally a name/label, a "единственная
   * запись"-style badge and a last-modified note; this component owns only the card chrome and
   * position, the caller owns the content — no business copy is baked into `shared/ui`, same rule
   * `AdminSummaryPanel`'s plain `rows` prop already follows.
   */
  identity: ReactNode
  /** Error / success banners for the save itself (e.g. "сервер не ответил"). */
  message?: ReactNode
  /** Tabs by field group + the field cards themselves. */
  children: ReactNode
  /**
   * The pinned save bar (proposal §C pin 2) — dirty-field count, which tabs hold the unsaved edits,
   * "Отменить правки" / "Сохранить" (`AdminActionButton`). Optional so a caller that prefers to
   * hide the whole bar while nothing is dirty can pass `undefined`; the proposal's own "Нечего
   * сохранять" state instead keeps the bar always mounted with both buttons disabled — either
   * behaviour is the calling page's call, this component only reserves the position and chrome.
   */
  footer?: ReactNode
  className?: string
}

/**
 * Template C — "Форма настройки" (designer proposal `admin-page-templates.html` §C). A frequency-
 * one special case of template B: exactly one record ever exists, and creating a second is
 * structurally impossible (no list route, no `/new`, no `/:id` — the screen itself IS the record).
 *
 * No control zone at the top at all (proposal: "Пусто сверху") — Add/Delete do not exist for this
 * archetype, and Save moves out of a toolbar into the pinned `footer` instead. No `breadcrumbs`
 * prop either: every existing example of this template (`/admin/settings`, `/admin/notifications`)
 * is a root screen, never opened "inside" another.
 */
export function SetupFormLayout({
  title,
  subtitle,
  identity,
  message,
  children,
  footer,
  className = '',
}: SetupFormLayoutProps) {
  return (
    <div className={`mx-auto flex w-full max-w-6xl flex-col gap-4 ${className}`}>
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-neutral-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-neutral-500">{subtitle}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        {identity}
      </div>

      {message && <div className="flex flex-col gap-2">{message}</div>}

      {children}

      {footer && (
        <div className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-[0_-4px_14px_rgba(10,10,10,.05)]">
          {footer}
        </div>
      )}
    </div>
  )
}
