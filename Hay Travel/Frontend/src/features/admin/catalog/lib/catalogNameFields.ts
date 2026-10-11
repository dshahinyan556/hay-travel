/**
 * The RU/EN name pair five of the six catalogs share (all but Regions), as two FLAT draft fields —
 * flat so the grid can mark «Название EN» as changed/invalid on its own, which a nested `Localized`
 * value could not express per language.
 */

import type { TranslatableCreateModel, TranslatableInfoModel } from '@/shared/types/attours'
import type { CatalogCopy } from './catalogCopy'
import type { FieldErrors } from './catalogDraft'
import { readLocalized, writeLocalized, writeLocalizedForUpdate } from './catalogMapper'

export interface NameValues {
  nameRu: string
  nameEn: string
}

export function nameValuesOf(translations: TranslatableInfoModel[]): NameValues {
  const name = readLocalized(translations)
  return { nameRu: name.ru, nameEn: name.en }
}

const trimmed = (values: NameValues) => ({ ru: values.nameRu.trim(), en: values.nameEn.trim() })

export const nameForCreate = (values: NameValues): TranslatableCreateModel[] => writeLocalized(trimmed(values))
export const nameForUpdate = (values: NameValues): TranslatableInfoModel[] => writeLocalizedForUpdate(trimmed(values))

/**
 * Both languages required — the rule every catalog side-panel form had (D4-1 pattern): the public
 * site resolves catalog text as `own(lang) ?? template(lang)` and never falls back from an empty EN
 * template to RU, so a template with no EN shows up empty for English visitors.
 */
export function validateName(values: NameValues, copy: CatalogCopy): FieldErrors<NameValues> {
  const errors: FieldErrors<NameValues> = {}
  if (values.nameRu.trim() === '') errors.nameRu = copy.common.requiredField
  if (values.nameEn.trim() === '') errors.nameEn = copy.common.requiredField
  return errors
}

/** Row caption for labels: RU name, else EN, else the caller's fallback. */
export const nameLabel = (values: NameValues, fallback: string): string =>
  values.nameRu.trim() || values.nameEn.trim() || fallback
