import { useCallback, useSyncExternalStore } from 'react'

/**
 * Visible viewport height in px — shrinks when the on-screen keyboard opens.
 *
 * `window.innerHeight`/`100dvh` do NOT reliably do this: several mobile browsers keep the layout
 * viewport (and anything sized off it, including `position: fixed` + `inset-0`) at the FULL
 * screen height even with the keyboard up, leaving it as an overlay instead of resizing anything.
 * `window.visualViewport` is the one API that tracks the actual visible area on both Android
 * Chrome and iOS Safari. Falls back to `window.innerHeight` where the API is unavailable — there
 * the keyboard-overlay problem this exists for does not occur anyway (old WebViews, desktop).
 */
export function useVisualViewportHeight(): number {
  const subscribe = useCallback((onStoreChange: () => void) => {
    const vv = window.visualViewport
    if (!vv) {
      window.addEventListener('resize', onStoreChange)
      return () => window.removeEventListener('resize', onStoreChange)
    }
    vv.addEventListener('resize', onStoreChange)
    return () => vv.removeEventListener('resize', onStoreChange)
  }, [])

  const getSnapshot = useCallback(() => window.visualViewport?.height ?? window.innerHeight, [])

  return useSyncExternalStore(subscribe, getSnapshot)
}
