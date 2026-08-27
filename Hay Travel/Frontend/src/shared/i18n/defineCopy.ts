import type { Locale } from '@/shared/lib/locale'
import { useLocale } from '@/shared/i18n/LocaleProvider'

/**
 * Copy modules — the admin panel's half of the i18n story (ADR 021).
 *
 * The public site reads flat keys from `dictionary.ts` through `t('key')`. `/admin` does NOT:
 * its text lives next to its feature, in `features/admin/<module>/lib/<module>Copy.ts`, declared
 * with `defineCopy(ru, en)` and read with `useCopy(...)`. That keeps ~640 admin strings inside the
 * lazily-loaded admin chunk instead of the bundle every public visitor downloads, lets eight
 * modules be edited without colliding in one 2700-line file, and — unlike a flat dictionary —
 * expresses what admin copy actually is: functions with arguments, plural forms and
 * `Record<Enum, string>` label maps.
 *
 * Both mechanisms are driven by the same `LocaleProvider`, so one switch changes both surfaces.
 *
 * Rules for every copy module (they are what makes the type-checking work):
 *
 * 1. The `ru` object is NOT annotated `as const`. Literal types (`title: 'Заказы'`) would make
 *    `en` unassignable to its own mapped type, and the module would stop compiling. `as const` is
 *    right in `dictionary.ts`, wrong here.
 * 2. Only TRANSLATABLE things go inside `defineCopy`. Everything else the module owns —
 *    `STATUS_ORDER`, `statusBadgeTone`, `formatOrderMoney`, error-code maps — stays a plain
 *    export of the same file.
 * 3. Outside React (route loader, pure helper) there is no hook: call the copy directly,
 *    `ordersCopy(locale)`, with the locale passed in as a parameter or read from
 *    `getStoredLocale()`.
 * 4. No interface string is written as a literal in JSX. Ever.
 */

/** Locale-dependent string set of one admin module. */
export type Copy<T extends object> = (locale: Locale) => T

/**
 * `ru` is the source of truth: the type is inferred from it ALONE. `en` is typed by the mapped
 * type `{ [K in keyof T]: T[K] }`, so it takes no part in inference and is checked against `ru`
 * instead — an extra key, a missing key or a function with a different signature is a build
 * error, not a silently blank string. Same guarantee `Record<TranslationKey, string>` gives the
 * public dictionary.
 *
 * Two parameters rather than `{ ru, en }` is deliberate (ADR 021, "Последствия"): it encodes the
 * asymmetry between the shipped copy and its translation. A third language turns this into a
 * record — a mechanical edit of this one file.
 */
export function defineCopy<T extends object>(ru: T, en: { [K in keyof T]: T[K] }): Copy<T> {
  return (locale) => (locale === 'en' ? (en as T) : ru)
}

/** Hook wrapper: resolves a copy module against the current `LocaleProvider` locale. The only way
 * a component should read copy — reaching for `ordersCopy('ru')` in a component would pin it to
 * one language and skip re-rendering on switch. */
export function useCopy<T extends object>(copy: Copy<T>): T {
  const { locale } = useLocale()
  return copy(locale)
}
