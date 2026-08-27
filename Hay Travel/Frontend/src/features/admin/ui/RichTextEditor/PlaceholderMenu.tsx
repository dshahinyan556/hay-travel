import { useRef, useState } from 'react'
import { Popover, Sheet, SHEET_SINGLE_DETENT } from '@/shared/ui'
import { useIsCompactViewport } from '@/shared/hooks'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminUiCopy } from '../adminUiCopy'
import type { RichTextPlaceholder } from './types'

interface PlaceholderMenuProps {
  items: readonly RichTextPlaceholder[]
  disabled: boolean
  onInsert: (token: string) => void
}

/**
 * "Вставить поле" menu (spec 011 §3.6) — a `Popover`/`Sheet` combo, not `ActionsMenu`: each row is
 * two lines (label + monospace token, optionally a hint), and `ActionsMenuItem.label` is a plain
 * string that can't carry that.
 */
export function PlaceholderMenu({ items, disabled, onInsert }: PlaceholderMenuProps) {
  const copy = useCopy(adminUiCopy).richText
  const isCompact = useIsCompactViewport()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  function close() {
    setOpen(false)
  }

  function select(token: string) {
    close()
    onInsert(token)
  }

  const list = (
    <ul role="menu" aria-label={copy.placeholderMenuLabel} className="flex flex-col py-1">
      {items.map((item) => (
        <li key={item.token} role="none">
          <button
            type="button"
            role="menuitem"
            onClick={() => select(item.token)}
            className="flex min-h-11 w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors hover:bg-neutral-100"
          >
            <span className="text-sm font-semibold text-neutral-900">{item.label}</span>
            <code className="text-[11px] text-neutral-400">{item.token}</code>
            {item.hint && <span className="text-xs text-neutral-500">{item.hint}</span>}
          </button>
        </li>
      ))}
    </ul>
  )

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-neutral-300 bg-white px-2.5 text-xs font-semibold text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {copy.placeholderButton}
      </button>

      {isCompact ? (
        <Sheet open={open} onClose={close} ariaLabel={copy.placeholderMenuLabel} detents={SHEET_SINGLE_DETENT}>
          <div data-sheet-scroll className="min-h-0 flex-1 overflow-auto">
            {list}
          </div>
        </Sheet>
      ) : (
        <Popover
          open={open}
          onClose={close}
          anchorRef={triggerRef}
          className="max-h-80 w-72 overflow-auto rounded-lg border border-neutral-200 bg-white shadow-lg"
        >
          {list}
        </Popover>
      )}
    </>
  )
}
