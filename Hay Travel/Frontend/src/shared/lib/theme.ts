export type Theme = 'dark' | 'light'

export const THEME_STORAGE_KEY = 'hay-travel-theme'

/**
 * `theme-color` per skin, mirrored from `--surface-page` in `index.css`.
 *
 * Keep these two hexes in sync with the CSS custom properties. Duplicated here (and once more,
 * unavoidably, in the pre-paint inline script in `index.html`, which runs before any module can
 * be imported) because the browser chrome (address bar) needs a value before React mounts.
 */
export const THEME_COLORS: Record<Theme, string> = {
  dark: '#0f0c08',
  light: '#f7f1e6',
}

/**
 * Reads the stored theme preference. Dark is the designed default and the fallback for
 * anything that isn't the literal string `'light'` — including a missing key, a corrupted
 * value, or `localStorage` being unavailable (private browsing / blocked storage).
 */
export function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

/** Persists the theme preference. Silently no-ops if storage is unavailable. */
export function persistTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage may be unavailable (private mode / blocked) — theme still applies for this tab.
  }
}

/**
 * Applies the theme to the document: sets `data-theme` (which `index.css` keys its token
 * overrides off) and syncs `<meta name="theme-color">` so the Android/iOS browser chrome
 * (address bar, task switcher card) matches the active skin instead of staying on its default.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  root.dataset.theme = theme

  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta) meta.content = THEME_COLORS[theme]
}
