/**
 * Nav-chrome variants — the ADMIN-chosen shape of the public site's header/bottom navigation.
 *
 * Twin of `shared/lib/palette.ts` in every respect except one: there is deliberately NO
 * `applyNavStyle` and no pre-paint script in `index.html`. A palette is a colour on `<html>` and
 * has to be right before the first frame (a colour flip mid-load is jarring); the nav variant is a
 * React branch (`app/layout/SiteHeader`), and swapping nav chrome once, on a visitor's first-ever
 * visit, is an accepted tradeoff. Every repeat visit is already correct on the first paint via
 * `readCachedNavStyle`.
 *
 * `erasableSyntaxOnly` in tsconfig forbids TS `enum`, so this is an `as const` array plus a
 * derived union — same pattern as `palette.ts` and `features/admin/lib/enums.ts`.
 */

/**
 * Известные фронту варианты навигации. Должны совпадать со значениями `theme.navStyle` в
 * `SiteSettingCatalog` на бэкенде.
 *  - `pill` — текущая плавающая капсула (`app/layout/Header` + `MobileTabBar`);
 *  - `rail` — «Стеклянная лента» во всю ширину (`app/layout/frosted/*`).
 */
export const NAV_STYLES = ['pill', 'rail'] as const

export type NavStyle = (typeof NAV_STYLES)[number]

/** Дефолт сайта — то, что было до появления настройки. Пустое/неизвестное значение → сюда. */
export const DEFAULT_NAV_STYLE: NavStyle = 'pill'

export const NAV_STYLE_STORAGE_KEY = 'hay-travel-nav-style'

/** Сужение неизвестной строки (значение с сервера / из localStorage) до известного варианта. */
export function isNavStyle(value: string | null | undefined): value is NavStyle {
  return typeof value === 'string' && (NAV_STYLES as readonly string[]).includes(value)
}

/**
 * Последний известный вариант. Неизвестное/битое/отсутствующее значение → `DEFAULT_NAV_STYLE`.
 *
 * Читается синхронно при инициализации состояния в `useSiteDesign`, чтобы у повторного посетителя
 * нужная шапка отрисовалась сразу, а не после ответа `GetPublic`.
 */
export function readCachedNavStyle(): NavStyle {
  try {
    const cached = localStorage.getItem(NAV_STYLE_STORAGE_KEY)
    return isNavStyle(cached) ? cached : DEFAULT_NAV_STYLE
  } catch {
    return DEFAULT_NAV_STYLE
  }
}

/** Кэширует вариант для следующей загрузки. Молча ничего не делает, если storage недоступен. */
export function cacheNavStyle(style: NavStyle): void {
  try {
    localStorage.setItem(NAV_STYLE_STORAGE_KEY, style)
  } catch {
    // Приватный режим / заблокированное хранилище — вариант всё равно применён к этой вкладке.
  }
}
