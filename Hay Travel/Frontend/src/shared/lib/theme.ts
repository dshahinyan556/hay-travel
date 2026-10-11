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

/**
 * Явный выбор посетителя, если он вообще был сделан. `null` — «выбора нет, следуй дефолту сайта».
 *
 * Двойник `readStoredTheme()`, но с ДРУГИМ контрактом, и подменять их друг другом нельзя.
 * `readStoredTheme` обязан вернуть конкретную тему — им красят экран. Здесь же важно ровно
 * обратное: различить «выбрал светлую» и «не выбирал ничего». На этом различии держатся сразу
 * две вещи — админский `theme.defaultMode` (ADR 018) и `preferredTheme: null` в предпочтениях
 * аккаунта, где `null` тоже значит «следуй сайту», а не «пусто».
 */
export function readThemeChoice(): Theme | null {
  try {
    const chosen = localStorage.getItem(THEME_STORAGE_KEY)
    return chosen === 'light' || chosen === 'dark' ? chosen : null
  } catch {
    return null
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
 * Снимает явный выбор посетителя: сайт снова следует за `theme.defaultMode`.
 *
 * Ключ серверного дефолта при этом НЕ трогается — он не выбор и не принадлежит посетителю.
 * Нужен в двух местах: аккаунт вернул `preferredTheme: null`, и человек вышел из аккаунта
 * (его тема не должна достаться следующему гостю на этом устройстве).
 */
export function clearStoredTheme(): void {
  try {
    localStorage.removeItem(THEME_STORAGE_KEY)
  } catch {
    // Same as `persistTheme`: a blocked store just means there was nothing to clear.
  }
}

/**
 * Сказать всем смонтированным `useTheme` перечитать состояние из хранилища.
 *
 * `storage` в своей же вкладке не срабатывает, поэтому запись в `localStorage` из кода сама по
 * себе никого не разбудит: `useSiteDesign` уже пользуется этим событием для серверного дефолта,
 * а теперь им же пользуются переключатель темы (чтобы вторая копия `useTheme` — в разделе
 * «Предпочтения» — не разъезжалась с шапкой) и синхронизация с аккаунтом.
 *
 * Вызывать ТОЛЬКО из обработчика события или из эффекта: `dispatchEvent` синхронно дёрнет
 * `setState` в чужих компонентах, и из фазы рендера это была бы ошибка React.
 */
export function notifyThemeChanged(): void {
  window.dispatchEvent(new Event(THEME_SYNC_EVENT))
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
