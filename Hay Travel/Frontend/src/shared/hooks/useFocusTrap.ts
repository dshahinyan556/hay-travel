import { useEffect } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    // `offsetParent === null` catches anything hidden by `display:none` on itself or a parent —
    // cheap and enough here, since the overlay never uses `visibility:hidden` on live content.
    (element) => element.offsetParent !== null || element === document.activeElement,
  )
}

/**
 * Keeps keyboard focus inside an open overlay and gives it back afterwards.
 *
 * On activation focus moves to the container itself (which must carry `tabIndex={-1}`), so a
 * screen reader announces the dialog before its contents — the same contract `shared/ui/Modal`
 * uses. Tab and Shift+Tab then cycle within the container instead of walking out into the page
 * behind it. On deactivation the previously focused element is restored, so closing the overlay
 * returns the user to whatever opened it.
 *
 * The listener is registered in the capture phase so it wins over any inner component that also
 * handles Tab.
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  active: boolean,
): void {
  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    container.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      const focusable = getFocusable(container)
      if (focusable.length === 0) {
        event.preventDefault()
        container.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const current = document.activeElement

      const outside = !container.contains(current)
      const atContainer = current === container

      if (event.shiftKey && (current === first || atContainer || outside)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (current === last || outside)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      previouslyFocused?.focus?.()
    }
  }, [containerRef, active])
}
