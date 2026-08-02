/**
 * Warns before unsaved form state is lost when the admin navigates away (originally D4-2,
 * settings screen; now shared with the tour form). Two escape routes have to be covered and
 * they need different mechanisms:
 *
 *  - leaving via the app's own navigation (sidebar, back button) — `useBlocker`, which holds
 *    the navigation back so the screen can ask with its own dialog;
 *  - closing / reloading the tab — `beforeunload`, the only thing the browser honours there.
 *    The prompt text is the browser's own and cannot be customised.
 *
 * Any screen that tracks its own dirty state can use this — pass `enabled` as
 * `isDirty && !isSubmitting` (or equivalent) so a save-in-flight doesn't block its own redirect.
 */

import { useEffect } from 'react'
import { useBlocker } from 'react-router'

export interface UnsavedChangesGuard {
  /** True while a navigation attempt is being held back and the dialog must be shown. */
  isBlocking: boolean
  /** Leave anyway, discarding the edits. */
  confirm: () => void
  /** Stay on the screen. */
  cancel: () => void
}

/** @param enabled Guard only while there is something to lose. */
export function useUnsavedChangesGuard(enabled: boolean): UnsavedChangesGuard {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      enabled && currentLocation.pathname !== nextLocation.pathname,
  )

  // Saving clears the dirty state; a dialog that is still open at that moment has become
  // meaningless, so release the pending navigation instead of leaving it stuck.
  useEffect(() => {
    if (!enabled && blocker.state === 'blocked') blocker.reset()
  }, [enabled, blocker])

  useEffect(() => {
    if (!enabled) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [enabled])

  return {
    isBlocking: blocker.state === 'blocked',
    confirm: () => blocker.proceed?.(),
    cancel: () => blocker.reset?.(),
  }
}
