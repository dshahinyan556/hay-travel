import { readCachedPalette, type PaletteId } from './palette'

export type Theme = 'dark' | 'light'

/** Явный выбор посетителя. Пишет ТОЛЬКО переключатель в шапке. */
export const THEME_STORAGE_KEY = 'hay-travel-theme'

/**
 * Закэшированный `theme.defaultMode` с сервера. Пишет ТОЛЬКО `useSiteDesign`.
 *
 * Отдельный ключ, а не запись в `THEME_STORAGE_KEY`: иначе серверный «мягкий» дефолт
 * превратился бы в личный выбор посетителя навсегда, и последующая смена дефолта админом на
 * него бы уже не подействовала (ADR 018, вопрос 3b).
 */
export const THEME_DEFAULT_STORAGE_KEY = 'hay-travel-theme-default'

/** Событие «настройки приехали, перечитай состояние» — слушает `useTheme`. */
export const THEME_SYNC_EVENT = 'hay-travel-theme-sync'

/**
 * `theme-color` на пересечении «пресет × тема», зеркалит `--surface-page`.
 * Дублируется (неизбежно) в pre-paint скрипте `index.html` — он выполняется до любого модуля.
 * Новый пресет = новая строка ЗДЕСЬ и в том скрипте.
 *
 * `obsidian.light` (`#f7f1e6`) уже слегка расходится с `--surface-page` светлой темы
 * (`#f4ede0`). Расхождение существующее и в Spec 006 намеренно НЕ чинится: правка коснулась бы
 * дефолтной палитры, которую эта задача не трогает.
 */
export const THEME_COLORS: Record<PaletteId, Record<Theme, string>> = {
  obsidian: { dark: '#0f0c08', light: '#f7f1e6' },
  basalt: { dark: '#0e1214', light: '#edeeec' },
}

/**
 * Reads the theme to open with, in strict priority order:
 *
 *   явный выбор посетителя ('light'/'dark') → закэшированный серверный дефолт → 'dark'
 *
 * Dark is the designed default and the fallback for anything that isn't one of the two literal
 * strings — including a missing key, a corrupted value, or `localStorage` being unavailable
 * (private browsing / blocked storage). The pre-paint script in `index.html` duplicates exactly
 * this order; keep them in sync.
 */
export function readStoredTheme(): Theme {
  try {
    const chosen = localStorage.getItem(THEME_STORAGE_KEY)
    if (chosen === 'light' || chosen === 'dark') return chosen
    return localStorage.getItem(THEME_DEFAULT_STORAGE_KEY) === 'light' ? 'light' : 'dark'
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
 * Кэширует серверный мягкий дефолт (`theme.defaultMode`). Ключ ВЫБОРА посетителя не трогает —
 * иначе дефолт превратился бы в личный выбор навсегда и админ больше не смог бы на него
 * повлиять. Silently no-ops if storage is unavailable.
 */
export function cacheDefaultMode(mode: Theme): void {
  try {
    localStorage.setItem(THEME_DEFAULT_STORAGE_KEY, mode)
  } catch {
    // Same as `persistTheme`: a blocked store just means no cross-visit memory.
  }
}

/**
 * Applies the theme to the document: sets `data-theme` (which `index.css` keys its token
 * overrides off) and syncs `<meta name="theme-color">` so the Android/iOS browser chrome
 * (address bar, task switcher card) matches the active skin instead of staying on its default.
 *
 * The chrome colour is read at the intersection of preset × theme (ADR 018): the address bar has
 * to match `--surface-page`, and that value now depends on which palette is active.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  root.dataset.theme = theme

  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta) meta.content = THEME_COLORS[readCachedPalette()][theme]
}
