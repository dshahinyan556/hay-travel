/**
 * Supported UI locales — the single source of truth for the whole app.
 *
 * Adding or removing a language is one edit: the `LOCALES` list below. The `Locale` union,
 * the header switch and any future dictionary keying all derive from it, so no component
 * hardcodes language codes in markup.
 *
 * Armenian (`hy`) was intentionally dropped — the product ships Russian + English only.
 */

import type { LanguageCode } from '@/shared/types/language'

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
  try {
    window.localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // Приватный режим / заблокированное хранилище. Язык всё равно применится к этой вкладке через
    // состояние `LocaleProvider`; пережить перезагрузку он не сможет, но бросать отсюда нельзя —
    // на этой записи стоит и переключатель в шапке, и применение языка из аккаунта.
  }
}

/** «Язык сменили в коде, а не через `setLocale`» — слушает `LocaleProvider`. Нужно, потому что
 *  `storage` в своей же вкладке не срабатывает (тот же довод, что у `THEME_SYNC_EVENT`). */
export const LOCALE_CHANGE_EVENT = 'hay-travel-locale-sync'

/** Разбудить `LocaleProvider` после прямой записи `setStoredLocale`. Только из обработчика
 *  события/эффекта — синхронно дёргает чужой `setState`. */
export function notifyLocaleChanged(): void {
  window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT))
}

/**
 * `LanguageCode` on the backend (`ATTours.Common/Enums/LanguageCode.cs`) — `Russian = 1`.
 *
 * Типизировано именно `LanguageCode`, а не `number`: этой картой язык интерфейса превращается в
 * `preferredLanguage` аккаунта (он же язык писем), и `number` заставил бы каждое такое место
 * дописывать `as LanguageCode`. Импорт только типовой — `locale.ts` остаётся leaf-модулем без
 * рантайм-зависимостей.
 */
export const LANGUAGE_CODE_BY_LOCALE: Record<Locale, LanguageCode> = { ru: 1, en: 2 }

/** Обратное преобразование — `preferredLanguage` с сервера в язык интерфейса. */
export const LOCALE_BY_LANGUAGE_CODE: Record<LanguageCode, Locale> = { 1: 'ru', 2: 'en' }
