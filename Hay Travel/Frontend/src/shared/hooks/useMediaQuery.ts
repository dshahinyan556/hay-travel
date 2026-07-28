import { useCallback, useSyncExternalStore } from 'react'

/**
 * Subscribes to a CSS media query and re-renders when it starts/stops matching.
 *
 * Built on `useSyncExternalStore` rather than `useState` + `useEffect`: the very first render
 * already gets the real value, so nothing flashes in the wrong layout for one frame, and React
 * owns the subscription lifecycle (no stale listener when the query string changes).
 *
 * Client-only by design — the app is a pure CSR Vite bundle, there is no server snapshot to
 * reconcile with.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onStoreChange)
      return () => list.removeEventListener('change', onStoreChange)
    },
    [query],
  )

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query])

  return useSyncExternalStore(subscribe, getSnapshot)
}

/**
 * Below Tailwind's `lg` breakpoint (1024px) — the width at which the region explorer swaps its
 * side column for a bottom sheet. Kept here so the JS gate and the `lg:` classes can never drift.
 */
export const COMPACT_VIEWPORT_QUERY = '(max-width: 1023.98px)'

/** True on phone/tablet-sized viewports, i.e. wherever the bottom-sheet layout is in effect. */
export function useIsCompactViewport(): boolean {
  return useMediaQuery(COMPACT_VIEWPORT_QUERY)
}

/**
 * True for finger/stylus input (no hover, coarse pointer). This is about the POINTER, not the
 * screen size: a touch laptop needs bigger hit targets even though it is wide, while a narrow
 * desktop window does not.
 */
export function useIsTouchDevice(): boolean {
  return useMediaQuery('(hover: none) and (pointer: coarse)')
}
