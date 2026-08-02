/**
 * Bilingual primitives of the admin panel.
 *
 * These two types are the smallest shared vocabulary of every admin form: the backend keeps
 * translatable text as flat `{ languageCode, value }` rows, while every admin screen binds to
 * a single RU/EN pair instead. They live at the feature level (not inside `tour-form/` or
 * `settings/`) because more than one screen needs them — see ADR 004.
 *
 * `types/form.ts` and `tour-form/reducer/tourFormReducer.ts` re-export them so the existing
 * import paths keep working.
 */

/** The two languages every localized field carries. */
export type LangKey = 'ru' | 'en'

/** A single translatable field held as its two language values. */
export interface Localized {
  ru: string
  en: string
}
