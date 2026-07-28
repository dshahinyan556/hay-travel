import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

export interface ModalProps {
  /** Controlled visibility. When false, nothing is rendered. */
  open: boolean
  /** Called on backdrop click, Escape, or the close affordance. */
  onClose: () => void
  /** Heading shown at the top of the dialog and wired as its accessible name. */
  title: string
  /** Dialog body — typically a short message followed by an action row. */
  children: React.ReactNode
  /** Element to focus when the dialog opens (e.g. the confirm button). Falls back to the dialog. */
  initialFocusRef?: React.RefObject<HTMLElement | null>
}

/**
 * Accessible modal dialog rendered in a portal on `document.body` so it escapes any parent
 * `overflow`/`transform` context. Handles the interaction contract a dialog needs: Escape and
 * backdrop-click to dismiss, body scroll lock while open, focus moved in on open and restored
 * to the previously focused element on close. Purely presentational otherwise — the caller owns
 * the content and the action buttons.
 */
export function Modal({ open, onClose, title, children, initialFocusRef }: ModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    // Move focus into the dialog once it's mounted.
    ;(initialFocusRef?.current ?? dialogRef.current)?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      previouslyFocused?.focus?.()
    }
  }, [open, onClose, initialFocusRef])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/50 p-4 sm:items-center"
      onMouseDown={(e) => {
        // Dismiss only when the backdrop itself is pressed, not on drags out of the dialog.
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl outline-none sm:p-6"
      >
        <h2 id={titleId} className="text-base font-bold text-neutral-900">
          {title}
        </h2>
        <div className="mt-2">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
