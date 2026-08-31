import { useId, type ReactNode } from 'react'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { ChevronDownIcon } from '@/shared/ui/icons'

interface AccountSectionProps {
  /** What this section changes — «Email», «Телефон», «Пароль». */
  title: string
  /** The value as it is right now, shown while collapsed so the visitor can read the whole account
   * without opening anything. Pass a node so a missing value can render as a muted dash. */
  currentValue: ReactNode
  open: boolean
  /** Ask the parent to open this section (and close its sibling — the parent owns that rule). */
  onToggle: () => void
  /** The section's editor, mounted only while open. */
  children: ReactNode
  /** Label for the toggle button, e.g. «Изменить email» — the visible chevron has no text. */
  toggleLabel: string
  /**
   * Visible caption of the toggle while COLLAPSED. Defaults to «Изменить», which is right for the
   * four editors; the sessions section passes «Показать» — it opens a list of devices, and nothing
   * in it is being "changed" until the visitor picks one. Additive: no existing caller changes.
   */
  actionLabel?: string
}

/**
 * One collapsible card on `/account`: title, current value, a toggle, and the editor.
 *
 * ── Why an accordion and not `shared/ui/Tabs` ─────────────────────────────────────────────────
 * `Tabs` is an admin-palette component (light teal literals) and would need a public-theme variant
 * for one screen. More importantly, tabs cost a second piece of state that has to stay in sync with
 * "which form is dirty", and at 375px a three-tab strip pushes the actual form below the fold. A
 * stack of cards reads top-to-bottom on a phone and reads as a table of contents on a desktop —
 * and closed sections show their current value, which tabs cannot.
 *
 * The parent keeps at most ONE section open: the three editors are mutually exclusive operations,
 * and an accidentally half-filled email flow sitting open under a password form is noise.
 *
 * Presentational: it owns no state and makes no requests.
 */
export function AccountSection({
  title,
  currentValue,
  open,
  onToggle,
  children,
  toggleLabel,
  actionLabel,
}: AccountSectionProps) {
  const { t } = useLocale()
  // Generated, not derived from `title`: the title is a translated string with spaces, which is not
  // a valid DOM id and would change with the language.
  const contentId = useId()

  return (
    <section className="rounded-2xl bg-panel-raised ring-1 ring-edge">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-[11px] font-semibold tracking-[.14em] text-ink-muted uppercase">
            {title}
          </h2>
          <div className="mt-0.5 text-sm break-words text-ink">{currentValue}</div>
        </div>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={contentId}
          aria-label={toggleLabel}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm text-ink-dim ring-1 ring-edge-strong transition-colors hover:text-gold-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
        >
          {open ? t('account.close') : (actionLabel ?? t('account.change'))}
          <ChevronDownIcon
            size={15}
            className={`transition-transform duration-[var(--dur-micro)] ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Unmounted, not hidden: a closed section must not keep half-typed credentials alive, and
          the email flow's state machine should genuinely restart when it is reopened. */}
      {open && (
        <div id={contentId} className="border-t border-edge px-4 py-4 sm:px-5">
          {children}
        </div>
      )}
    </section>
  )
}
