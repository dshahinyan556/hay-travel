import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getStoredLocale, setStoredLocale, type Locale } from '@/shared/lib/locale'
import { translate } from './translate'
import type { TranslationKey } from './dictionary'

interface LocaleContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  /** Bound to the current locale — see `translate` for the actual lookup. */
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

/**
 * Mounted once at the app root (`App.tsx`), above the router, so both the public site and `/admin`
 * are inside it — one provider, one stored preference, one switch semantics for the whole product
 * (ADR 021). `/admin` renders its own `AdminLanguageSwitch` (admin chrome palette) instead of the
 * public `LanguageSwitch`, but both write to this same state, which is deliberate: the same person
 * uses both surfaces and there is no scenario where the panel and the site should disagree.
 *
 * State is the single source of truth for the visitor's choice; `localStorage` is only there so
 * a plain `getStoredLocale()` read (route loaders, `shared/api`) sees the same value outside
 * React. `setLocale` writes it synchronously, in the same tick as the state update — NOT from a
 * `useEffect` — because `RootLayout`'s `useRevalidateOnLocaleChange` (a descendant, so its effects
 * run before this provider's own) reads storage the moment `locale` changes to re-run the active
 * loader; an effect-based write here would still be pending when that fires, and the loader would
 * re-fetch in the locale that is about to be replaced, not the one just chosen. The admin tree does
 * NOT mount that hook and does not need to: admin loaders fetch every translation row (RU + EN) in
 * one go, so a locale change there is a pure re-render, never a refetch.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => getStoredLocale())

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = (next: Locale) => {
    setStoredLocale(next)
    setLocaleState(next)
  }

  const value: LocaleContextValue = {
    locale,
    setLocale,
    t: (key, vars) => translate(locale, key, vars),
  }

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
  return ctx
}
