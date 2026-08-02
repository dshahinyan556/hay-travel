/**
 * Supported UI locales — the single source of truth for the whole app.
 *
 * Adding or removing a language is one edit: the `LOCALES` list below. The `Locale` union,
 * the header switch and any future dictionary keying all derive from it, so no component
 * hardcodes language codes in markup.
 *
 * Armenian (`hy`) was intentionally dropped — the product ships Russian + English only.
 */

export interface LocaleDescriptor {
  /** BCP 47 tag. Also the value for `<html lang>` and the backend `languageCode` mapping. */
  readonly code: string
  /** Short caption shown on the switch pill. */
  readonly label: string
  /** Endonym, used for accessible names where the two-letter label is too terse. */
  readonly name: string
}

export const LOCALES = [
  { code: 'ru', label: 'RU', name: 'Русский' },
  { code: 'en', label: 'EN', name: 'English' },
] as const satisfies readonly LocaleDescriptor[]

/** Union of supported locale codes, derived from `LOCALES` — never written out by hand. */
export type Locale = (typeof LOCALES)[number]['code']

/** Russian is the shipped copy, so it is both the initial and the fallback locale. */
export const DEFAULT_LOCALE: Locale = 'ru'

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && LOCALES.some((locale) => locale.code === value)
}

/**
 * Narrows an untrusted locale (persisted preference, URL segment, `navigator.language`) to a
 * supported one. Anything unknown — including a stale `'hy'` left over from when Armenian was
 * offered — falls back to the default instead of propagating an invalid code.
 */
export function normalizeLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE
}

const STORAGE_KEY = 'hay-travel-locale'

/**
 * Synchronous locale read, safe outside React (route loaders run before any component mounts).
 * Backed by the same `localStorage` key `LocaleProvider` writes to, so a loader always sees
 * whatever the visitor last chose — including on a cold load, before the provider itself runs.
 */
export function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE
  return normalizeLocale(window.localStorage.getItem(STORAGE_KEY))
}

export function setStoredLocale(locale: Locale): void {
  window.localStorage.setItem(STORAGE_KEY, locale)
}

/** `LanguageCode` on the backend (`ATTours.Common/Enums/LanguageCode.cs`) — `Russian = 1`. */
export const LANGUAGE_CODE_BY_LOCALE: Record<Locale, number> = { ru: 1, en: 2 }
