import { useEffect, useRef } from 'react'
import { useRevalidator } from 'react-router'
import { useLocale } from './LocaleProvider'

/**
 * Re-runs the active route's loader when the locale changes, so tour/region content (fetched
 * from the backend already resolved to one `languageCode`, see `shared/api/tours.ts`) catches up
 * with the flipped `LanguageSwitch` pill without a full navigation. Skips the initial mount —
 * the loader already ran once for the current locale before this effect ever fires.
 *
 * Lives in its own hook (not inside `LocaleProvider`) because it needs `useRevalidator`, which
 * only works below `RouterProvider` — `LocaleProvider` itself is mounted above the router in
 * `App.tsx`, so it can't call this. Call it once from `RootLayout`, which is inside the tree.
 */
export function useRevalidateOnLocaleChange(): void {
  const { locale } = useLocale()
  const revalidator = useRevalidator()
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    revalidator.revalidate()
    // `revalidator` is a new object on every render; only `locale` should trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale])
}
