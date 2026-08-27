import { useCallback, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useIsCompactViewport } from '@/shared/hooks'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { Popover } from './Popover'
import { Sheet, SHEET_SINGLE_DETENT } from './Sheet'
import { CloseIcon } from './icons'

export interface HelpPanelProps {
  title: string
  /** Already-localised text — owned by the calling page/feature, not by this component (mirrors
   * `settingsCopy.ts`/`userCopy.ts`: each feature keeps its own copy module). */
  children: ReactNode
  /** Accessible name of the trigger button. Defaults to `t('ui.help.trigger', { title })`. */
  triggerLabel?: string
  /**
   * Which palette to render in — same contract and same reasoning as `Select`'s own `surface`
   * prop (see the long comment above it in `Select.tsx`): `/admin` never touches `data-theme`, so
   * reading it here would risk rendering the PUBLIC gold/wine skin inside an admin screen whenever
   * a visitor had switched the public site's theme earlier in the same tab. Added for F4 (the
   * first real `/admin` consumer, the user-detail screen) — flagged as an open question in this
   * component's original doc comment, resolved the same way `Select` already resolved it.
   * @default 'public'
   */
  surface?: 'public' | 'admin'
}

/**
 * Small round "?" trigger + popup with a short explanation — the one reusable "Help" pattern for
 * any admin/public page (introduced 2026-08-06 by Давид's request, architecture decision in
 * `admin-fixes-checklist-2026-08-06.txt` F14). Lives in `shared/ui` rather than
 * `features/admin/ui` on purpose: it carries no admin-specific types or role checks, it is just a
 * trigger + text content wrapping two already-shared primitives.
 *
 * Desktop: `Popover`. Compact viewport: `Sheet`, via the same `useIsCompactViewport` switch
 * `Select`/`DatePicker` already use — no new overlay mechanism.
 *
 * Escape / outside click / a close button all dismiss it (`Popover` and `Sheet` already implement
 * the first two; the close button is added here to mirror the mockup's `.hp-close`, since a
 * passive help panel has no natural "select and close" action the way `Select`'s options do).
 *
 * Styled with the public site's role tokens by default (`bg-panel-raised`/`ring-edge-strong`/
 * `text-gold-ink`) — `surface="admin"` switches to admin's own light/teal literals instead,
 * exactly as `Select` does for the same reason (`data-theme` cannot disambiguate the two panels).
 */
export function HelpButton({ title, children, triggerLabel, surface = 'public' }: HelpPanelProps) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const isCompact = useIsCompactViewport()
  const titleId = useId()

  const { t } = useLocale()

  const close = useCallback(() => setOpen(false), [])
  const label = triggerLabel ?? t('ui.help.trigger', { title })

  const triggerClasses =
    surface === 'admin'
      ? 'bg-white text-neutral-600 ring-1 ring-neutral-300 hover:bg-neutral-100 hover:ring-neutral-400 focus-visible:ring-2 focus-visible:ring-neutral-900/30 focus-visible:outline-none'
      : 'bg-panel-raised text-gold-ink ring-1 ring-edge-strong hover:bg-gold-soft hover:ring-gold-line focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none'
  const panelClasses =
    surface === 'admin'
      ? 'w-[270px] rounded-xl border border-neutral-200 bg-white shadow-lg'
      : 'w-[270px] rounded-xl border border-edge-strong bg-panel-raised shadow-lg'
  const titleClasses = surface === 'admin' ? 'text-sm font-semibold text-neutral-900' : 'text-sm font-semibold text-ink'
  const closeClasses =
    surface === 'admin'
      ? 'icon-press -m-1 flex shrink-0 items-center justify-center rounded-full p-1 text-neutral-400 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-900/30 focus-visible:outline-none'
      : 'icon-press -m-1 flex shrink-0 items-center justify-center rounded-full p-1 text-ink-muted hover:text-gold-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none'
  const bodyClasses = surface === 'admin' ? 'text-neutral-600' : 'text-ink-dim'

  const panelBody = (
    <div className="p-3.5 text-sm">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <h2 id={titleId} className={titleClasses}>
          {title}
        </h2>
        <button type="button" onClick={close} aria-label={t('ui.help.close')} className={closeClasses}>
          <CloseIcon size={14} />
        </button>
      </div>
      <div className={bodyClasses}>{children}</div>
    </div>
  )

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        className={`icon-press inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-xs font-bold ${triggerClasses}`}
      >
        <span aria-hidden="true">?</span>
      </button>

      {isCompact ? (
        <Sheet open={open} onClose={close} ariaLabel={title} detents={SHEET_SINGLE_DETENT}>
          {panelBody}
        </Sheet>
      ) : (
        <Popover open={open} onClose={close} anchorRef={anchorRef} className={panelClasses}>
          <div role="dialog" aria-labelledby={titleId}>
            {panelBody}
          </div>
        </Popover>
      )}
    </>
  )
}
