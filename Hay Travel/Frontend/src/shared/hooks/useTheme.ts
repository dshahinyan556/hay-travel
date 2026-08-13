import { useCallback, useEffect, useState } from 'react'
import {
  applyTheme,
  persistTheme,
  readStoredTheme,
  THEME_SYNC_EVENT,
  type Theme,
} from '@/shared/lib/theme'

/**
 * Single source of truth for the public site's dark/light switch (rendered by `ThemeToggle`,
 * only inside `Header`, i.e. never in `/admin`).
 *
 * Dark is the designed default; the stored preference is the only thing that moves us to
 * light — `prefers-color-scheme` is deliberately ignored, otherwise a visitor on a light-mode
 * OS would land on the secondary skin instead of the intended look.
 *
 * `data-theme` on `<html>` is already set before first paint by the inline script in
 * `index.html` (avoids a flash of the wrong theme on load); this hook keeps React state,
 * `localStorage` and the DOM attribute in sync from then on, including:
 *  - re-applying the theme when the tab regains visibility (covers a phone coming back from
 *    the background, and covers another tab having changed the preference in the meantime),
 *  - a `storage` listener so switching the theme in one tab is reflected in others.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    applyTheme(theme)
    persistTheme(theme)
  }, [theme])

  useEffect(() => {
    function resyncFromStorage() {
      setTheme(readStoredTheme())
    }
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') resyncFromStorage()
    }
    window.addEventListener('storage', resyncFromStorage)
    // `storage` does NOT fire in the tab that wrote the value, so the server-side default cached
    // by `useSiteDesign` reaches this hook by an explicit event instead (ADR 018, question 3c —
    // `useTheme` stays the single owner of `data-theme`; nobody else applies a theme).
    window.addEventListener(THEME_SYNC_EVENT, resyncFromStorage)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('storage', resyncFromStorage)
      window.removeEventListener(THEME_SYNC_EVENT, resyncFromStorage)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggleTheme }
}
