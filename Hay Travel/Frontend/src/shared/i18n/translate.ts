import type { Locale } from '@/shared/lib/locale'
import { DICTIONARIES, type TranslationKey } from './dictionary'

/**
 * Pure translation lookup, usable outside React (route loaders/`shared/api` run before any
 * component mounts, so they can't call a hook). `LocaleProvider`'s `t` is a thin wrapper that
 * binds this to the current locale from context.
 */
export function translate(
  locale: Locale,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  let str = DICTIONARIES[locale][key]
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      str = str.replaceAll(`{${name}}`, String(value))
    }
  }
  return str
}

export type { TranslationKey }
