import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  getStoredLocale,
  LOCALE_CHANGE_EVENT,
  notifyLocaleChanged,
  setStoredLocale,
  type Locale,
} from '@/shared/lib/locale'
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

  /**
   * Язык, выбранный ВНЕ провайдера, — сегодня это одно место: предпочтения аккаунта приехали с
   * сервера и записали `hay-travel-locale` напрямую (`shared/lib/accountPreferences`). Событие, а
   * не `storage`: в своей же вкладке `storage` не срабатывает. `storage` слушается рядом и делает
   * то же самое для соседней вкладки — сегодня это единственный способ узнать, что язык сменили
   * там (раньше вкладки просто расходились до перезагрузки).
   */
  useEffect(() => {
    function resync() {
      setLocaleState(getStoredLocale())
    }
    window.addEventListener(LOCALE_CHANGE_EVENT, resync)
    window.addEventListener('storage', resync)
    return () => {
      window.removeEventListener(LOCALE_CHANGE_EVENT, resync)
      window.removeEventListener('storage', resync)
    }
  }, [])

  /**
   * `notifyLocaleChanged` рассылается ПОСЛЕ записи и состояния: на него подписана синхронизация с
   * аккаунтом, которая для залогиненного отправляет язык на сервер (он же язык писем о заказах).
   * Гостя это не касается — стор ничего не делает без сессии.
   */
  const setLocale = (next: Locale) => {
    setStoredLocale(next)
    setLocaleState(next)
    notifyLocaleChanged()
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
