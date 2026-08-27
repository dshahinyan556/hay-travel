import { useRef, useState } from 'react'
import { Popover } from './Popover'
import { MoreIcon } from './icons'

export interface ActionsMenuItem {
  key: string
  label: string
  onClick: () => void
  disabled?: boolean
  /** Destructive action (e.g. "Удалить заказ") — rendered in the danger color, same red family
   * `Button`'s `danger` variant uses. */
  danger?: boolean
}

export interface ActionsMenuProps {
  items: ActionsMenuItem[]
  /** Accessible name of the trigger — e.g. "Действия по заказу №240816-0007". */
  label: string
  disabled?: boolean
}

/**
 * Admin-surface kebab dropdown — built on `Popover`, modelled on `app/layout/UserMenu`'s
 * account-menu markup (`role="menu"`/`role="menuitem"`, close-on-select), but in the admin panel's
 * light teal palette instead of the public site's dark-luxury one (same split `Select` documents
 * for `surface`).
 *
 * Replaces a row of separate action buttons (checklist-orders-redesign.txt Фаза 9.1) — one trigger,
 * one place for every order-level action (assign all, send to client, delete, …).
 */
export function ActionsMenu({ items, label, disabled = false }: ActionsMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  function select(item: ActionsMenuItem) {
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
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <MoreIcon size={20} />
      </button>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={triggerRef}
        className="w-56 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
      >
        <div role="menu" aria-label={label} className="flex flex-col">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => select(item)}
              className={`min-h-11 px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                item.danger
                  ? 'text-rose-700 hover:bg-rose-50'
                  : 'text-neutral-800 hover:bg-neutral-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Popover>
    </>
  )
}
