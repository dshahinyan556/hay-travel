import { useEffect } from 'react'

/**
 * Freezes background scrolling while an overlay (modal, drawer, bottom sheet) is on screen.
 *
 * Single implementation of the `body { overflow: hidden }` trick that the admin drawer and
 * `shared/ui/Modal` were each doing inline. The previous value is captured and restored rather
 * than hard-reset to `''`, so nesting one overlay inside another cannot unlock the page early.
 */
export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return

    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previous
    }
  }, [locked])
}
