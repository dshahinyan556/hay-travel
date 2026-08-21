import { useId, useRef, useState } from 'react'
import { Popover } from './Popover'
import { MoreIcon } from './icons'

export interface AdminActionsMenuItem {
  label: string
  onClick: () => void
  disabled?: boolean
}

export interface AdminActionsMenuGroup {
  title: string
  items: AdminActionsMenuItem[]
}

export interface AdminActionsMenuProps {
  /** Group-columns, left to right. An empty array hides the trigger entirely (checklist §6: "если
   * после переноса… не остаётся реальных пунктов — меню можно… скрыть триггер"), so a caller can
   * always render `<AdminActionsMenu groups={groups} .../>` unconditionally. */
  groups: AdminActionsMenuGroup[]
  /** Accessible name of the trigger, e.g. "Дополнительные действия по заказу №240816-0007". */
  label: string
  disabled?: boolean
  className?: string
}

/**
 * Grouped "…" action menu (checklist `order-toolbar-summary-checklist-2026-08-21.txt` §6) — the
 * Acumatica-style dropdown, laid out as GROUP-COLUMNS side by side (each a heading + its own list
 * of items) rather than `shared/ui/ActionsMenu`'s single flat list. Built on the same `Popover`
 * primitive as `ActionsMenu`/`Select`, in the strict black/white palette (no `brand-*` teal, no
 * destructive-red — this menu was scoped down to NOT carry a `danger` item at all, see §6: the
 * placeholder "coming soon" entries were cut, and every action with real destructive weight
 * (Delete) lives on `AdminToolbar` instead, not in here).
 *
 * Columns stack vertically below `sm` so a narrow phone gets a scrollable list instead of a panel
 * wider than the viewport.
 */
export function AdminActionsMenu({ groups, label, disabled = false, className = '' }: AdminActionsMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const baseId = useId()

  if (groups.length === 0) return null

  function select(item: AdminActionsMenuItem) {
    if (item.disabled) return
    setOpen(false)
    item.onClick()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-900 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-[.42] ${
          open
            ? 'border-neutral-900 bg-neutral-900 text-white'
            : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50'
        } ${className}`}
      >
        <MoreIcon size={18} />
      </button>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={triggerRef}
        className="flex max-h-[80vh] max-w-[92vw] flex-col divide-y divide-neutral-100 overflow-auto rounded-xl border border-neutral-200 bg-white py-1 shadow-[0_10px_30px_rgba(10,10,10,.12),0_2px_6px_rgba(10,10,10,.06)] sm:flex-row sm:divide-x sm:divide-y-0"
      >
        <div role="menu" aria-label={label} className="flex flex-col sm:flex-row">
          {groups.map((group, groupIndex) => {
            const titleId = `${baseId}-group-${groupIndex}`
            return (
              <div key={titleId} role="group" aria-labelledby={titleId} className="flex min-w-[190px] flex-col py-1">
                <div
                  id={titleId}
                  className="px-3 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-neutral-400 uppercase"
                >
                  {group.title}
                </div>
                {group.items.map((item, itemIndex) => (
                  <button
                    key={itemIndex}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={() => select(item)}
                    className="min-h-9 px-3 py-1.5 text-left text-sm whitespace-nowrap text-neutral-800 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </Popover>
    </>
  )
}
