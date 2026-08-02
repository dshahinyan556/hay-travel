/**
 * The single place that converts between the site-settings wire format and the form
 * view-model, and the single place that knows the payload rules of `PUT SiteSettings/Update`.
 *
 * Two rules come straight from the backend implementation and must not be relaxed:
 *
 *  1. Upsert is keyed by `key`, never by `id` — `SiteSettingUpdateModel` has no id field.
 *  2. `ReconcileTranslations` DELETES any stored language missing from the payload. So a
 *     translatable key always ships BOTH rows (RU + EN), even when only one of them changed.
 *     Sending RU alone would wipe EN from the database.
 */

import { LanguageCode, SettingValueType } from '@/features/admin/lib/enums'
import type {
  SiteSettingInfoModel,
  SiteSettingUpdateModel,
  TranslatableInfoModel,
} from '@/shared/types/attours'
import type { Localized } from '@/features/admin/types/localized'
import type {
  SettingFieldState,
  SettingsFormState,
  SettingsSection,
} from '@/features/admin/settings/types'

/* -------------------------------------------------------------------------- */
/*  wire -> form                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Read the RU/EN pair out of a setting's flat translation list.
 *
 * `readLocalized` from `tourMapper.ts` is intentionally NOT reused: it filters by `type`,
 * which is a meaningless field for setting translations (the server always sends 0). Relying
 * on that coincidence would be a latent bug, not code sharing. A missing language reads as ''.
 */
function readSettingLocalized(translations: TranslatableInfoModel[] | null): Localized {
  const find = (lang: number): string =>
    (translations ?? []).find((t) => t.languageCode === lang)?.value ?? ''
  return { ru: find(LanguageCode.Russian), en: find(LanguageCode.English) }
}

/** Known value types pass through; anything else renders as a plain text input rather than
 * disappearing — a catalog can gain a type before the front knows about it (ADR 002). */
function toValueType(raw: number): SettingValueType {
  return raw === SettingValueType.MultilineText ||
    raw === SettingValueType.Url ||
    raw === SettingValueType.ImageUrl
    ? raw
    : SettingValueType.Text
}

/**
 * Wire -> form. Sections appear in the order their group is first seen (the server already
 * sorted the list by `sortOrder`), and keys keep that same order inside a section. Nothing is
 * filtered out: whatever the catalog returns, the screen renders.
 */
export function settingsToForm(dto: SiteSettingInfoModel[]): SettingsFormState {
  const fields: Record<string, SettingFieldState> = {}
  const sections: SettingsSection[] = []
  const sectionByGroup = new Map<number, SettingsSection>()

  for (const item of dto) {
    fields[item.key] = {
      key: item.key,
      id: item.id,
      valueType: toValueType(item.valueType),
      isTranslatable: item.isTranslatable,
      value: item.value ?? '',
      translations: readSettingLocalized(item.translations),
    }

    let section = sectionByGroup.get(item.group)
    if (!section) {
      section = { group: item.group, keys: [] }
      sectionByGroup.set(item.group, section)
      sections.push(section)
    }
    section.keys.push(item.key)
  }

  return { fields, sections }
}

/* -------------------------------------------------------------------------- */
/*  form -> wire                                                               */
/* -------------------------------------------------------------------------- */

/** `TranslatableCreateModel.type` is required by the wire type but ignored by the backend for
 * settings — same trick the tour mapper uses for expenses and route points. */
const IGNORED_TRANSLATION_TYPE = 0

/** Build the payload for exactly one setting, applying the two backend rules above. */
function toUpdateModel(field: SettingFieldState): SiteSettingUpdateModel {
  if (!field.isTranslatable) {
    return { key: field.key, value: field.value.trim(), translations: [] }
  }
  return {
    key: field.key,
    // Correct semantics, not a shortcut: for a translatable key the server resolves the
    // translation and never looks at `Value`.
    value: null,
    translations: [
      {
        type: IGNORED_TRANSLATION_TYPE,
        languageCode: LanguageCode.Russian,
        value: field.translations.ru.trim(),
      },
      {
        type: IGNORED_TRANSLATION_TYPE,
        languageCode: LanguageCode.English,
        value: field.translations.en.trim(),
      },
    ],
  }
}

/** Two settings are equal when the payloads they would produce are equal — i.e. after the same
 * trimming the payload applies. Typing and deleting a space therefore leaves nothing dirty. */
function isUnchanged(baseline: SettingFieldState, current: SettingFieldState): boolean {
  if (current.isTranslatable) {
    return (
      baseline.translations.ru.trim() === current.translations.ru.trim() &&
      baseline.translations.en.trim() === current.translations.en.trim()
    )
  }
  return baseline.value.trim() === current.value.trim()
}

/**
 * Form -> partial payload: only the keys that actually differ from the baseline. Sending the
 * untouched keys as well would rewrite them with the admin's own stale values and would create
 * a DB row for every setting the admin never filled in.
 */
export function diffToUpdateModels(
  baseline: Record<string, SettingFieldState>,
  current: Record<string, SettingFieldState>,
): SiteSettingUpdateModel[] {
  const payload: SiteSettingUpdateModel[] = []

  for (const field of Object.values(current)) {
    const before = baseline[field.key]
    if (before && isUnchanged(before, field)) continue
    payload.push(toUpdateModel(field))
  }

  return payload
}
