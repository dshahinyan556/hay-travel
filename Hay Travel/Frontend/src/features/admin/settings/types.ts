/**
 * View-model of the settings screen.
 *
 * Deliberately different from the wire DTOs in `shared/types/attours.ts`: the backend keeps a
 * flat list of `{ languageCode, value }` rows per setting, the form binds to a single RU/EN
 * pair. The conversion lives in one place only — `settings/lib/settingsMapper.ts`; no
 * component under `settings/` ever sees the wire format.
 */

import type { SettingValueType } from '@/features/admin/lib/enums'
import type { Localized } from '@/features/admin/types/localized'
import type { SiteSettingOptionModel } from '@/shared/types/attours'

/** One editable setting. */
export interface SettingFieldState {
  /** `hero.title` — the record's identity for the backend (upsert is keyed by it, not by id). */
  key: string
  /**
   * Row id in the DB. `0` means the key is known to the server catalog but has never been
   * saved — the screen shows a "не заполнено" badge for it. It is NOT sent back: the update
   * endpoint has no id field at all.
   */
  id: number
  /** Which control renders this setting. Unknown wire values are normalised to `Text`. */
  valueType: SettingValueType
  isTranslatable: boolean
  /** Допустимые значения для `valueType === Select`. Для остальных типов — пустой массив. */
  options: SiteSettingOptionModel[]
  /** Language-neutral value. Used ONLY when `isTranslatable === false`. */
  value: string
  /** The RU/EN pair. Used ONLY when `isTranslatable === true`. */
  translations: Localized
}

/**
 * One section of the screen = one catalog group. Layout only — it holds keys, never copies of
 * values, so it can never drift out of sync with `fields`.
 */
export interface SettingsSection {
  /** A `SiteSettingGroup` value. Kept as a plain number: the server may introduce a group the
   * front does not know yet (ADR 002 allows it without a front-end deploy). */
  group: number
  /** Keys in the `sortOrder` the server sent them in. */
  keys: string[]
}

/** The whole form. */
export interface SettingsFormState {
  /** The only thing typing changes. */
  fields: Record<string, SettingFieldState>
  /** Layout. Built once from the server response; never rebuilt while typing. */
  sections: SettingsSection[]
}
