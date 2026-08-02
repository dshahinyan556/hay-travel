import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useBodyScrollLock, useFocusTrap } from '@/shared/hooks'

export interface SidePanelProps {
  open: boolean
  /** Called on backdrop click, Escape, or the header's close button. */
  onClose: () => void
  /** Heading shown at the top of the panel and wired as its accessible name. */
  title: string
  children: React.ReactNode
}

/**
 * Slide-in-from-the-right panel for a catalog add/edit form (4.2) — the list stays visible
 * behind it, no route change. Same interaction contract as `shared/ui/Modal` (Escape,
 * backdrop-click, focus trap, body scroll lock, portal to `document.body`) but docked to the
 * right edge and full-height instead of a centered card, and it stays MOUNTED through its exit
 * transition rather than unmounting immediately (an admin form panel closing needs to slide
 * away, not vanish).
 *
 * Full-width on narrow viewports (there is no room for a side gutter at 375px) and a fixed
 * 420px column from `sm` up — the same transform-based slide `AdminLayout`'s mobile nav drawer
 * already uses, just docked right instead of left.
 */
export function SidePanel({ open, onClose, title, children }: SidePanelProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  // The exit transition needs the last real content while it slides away.
  const lastContentRef = useRef<React.ReactNode>(null)

  useEffect(() => {
    if (open) {
      setMounted(true)
      return
    }
    const timer = window.setTimeout(() => setMounted(false), 220)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (open) lastContentRef.current = children
  }, [open, children])

  useBodyScrollLock(mounted)
  useFocusTrap(panelRef, open && mounted)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className={`absolute inset-0 bg-neutral-900/50 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-full max-w-full flex-col bg-white shadow-2xl outline-none transition-transform duration-200 sm:w-[420px]"
        style={{ transform: open ? 'translateX(0)' : 'translateX(100%)' }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h2 id={titleId} className="text-base font-bold text-neutral-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {open ? children : lastContentRef.current}
        </div>
      </div>
    </div>,
    document.body,
  )
}
