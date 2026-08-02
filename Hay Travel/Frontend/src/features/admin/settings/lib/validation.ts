/**
 * Derived, pure validation for the settings screen. Takes the current fields and returns the
 * blocking errors plus the soft hints — it holds no state and never mutates.
 *
 * Blocking rule (D4-1): a translatable key requires BOTH languages. The backend resolves a
 * value as `перевод(язык) ?? Value ?? дефолт`, and for a translatable key `Value` is always
 * null — so an empty EN is literally an empty spot on the site for an English visitor. That is
 * closed here, at the entrance, rather than by changing the (already closed) backend stage.
 *
 * Everything else is optional. A `Url`/`ImageUrl` value that does not look like a link gets a
 * non-blocking hint: the backend deliberately does not validate URL shape, and a value can be
 * legitimately unusual, so it must never stop the admin from saving.
 */

import { SettingValueType } from '@/features/admin/lib/enums'
import type { SettingFieldState } from '@/features/admin/settings/types'

const REQUIRED = 'Обязательное поле'
const SUSPICIOUS_URL = 'Похоже на неполную ссылку — обычно адрес начинается с https:// или со «/».'

/** Blocking errors of one bilingual field, per language. */
export interface LocalizedErrors {
  ru?: string
  en?: string
}

export interface SettingsValidation {
  /** Blocking errors keyed by setting key. An absent key means that field is fine. */
  errors: Record<string, LocalizedErrors>
  /** Non-blocking hints keyed by setting key. Never affects `isValid`. */
  warnings: Record<string, string>
  /** How many translatable settings are still missing a language — shown in the action bar. */
  missingCount: number
  /** True only when nothing blocks saving. */
  isValid: boolean
}

/** A link is expected to be absolute (`http(s)://`) or site-relative (`/…`). */
function looksLikeLink(value: string): boolean {
  return /^(https?:\/\/|\/)/.test(value)
}

export function validateSettings(fields: Record<string, SettingFieldState>): SettingsValidation {
  const errors: Record<string, LocalizedErrors> = {}
  const warnings: Record<string, string> = {}
  let missingCount = 0

  for (const field of Object.values(fields)) {
    if (field.isTranslatable) {
      const fieldErrors: LocalizedErrors = {}
      if (field.translations.ru.trim() === '') fieldErrors.ru = REQUIRED
      if (field.translations.en.trim() === '') fieldErrors.en = REQUIRED
      if (fieldErrors.ru || fieldErrors.en) {
        errors[field.key] = fieldErrors
        missingCount += 1
      }
      continue
    }

    const isLinkField =
      field.valueType === SettingValueType.Url || field.valueType === SettingValueType.ImageUrl
    const value = field.value.trim()
    if (isLinkField && value !== '' && !looksLikeLink(value)) {
      warnings[field.key] = SUSPICIOUS_URL
    }
  }

  return { errors, warnings, missingCount, isValid: missingCount === 0 }
}
