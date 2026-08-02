/**
 * Shared read/write helpers for the three catalog screens (Places, Expense templates, Note
 * templates). Each entry has exactly one translatable field (its name), always encoded as
 * translation `type: 0` — mirrors `tourMapper.ts`'s `readLocalized`/`writeLocalized`, but is
 * NOT imported from there: that file is a tour-specific mapper (ADR-style separation already
 * used for `settingsMapper.ts`, whose header explains the same call — a matching sentinel
 * today is not a reason to couple two unrelated domains' mappers together).
 *
 * `writeLocalized` returns `TranslatableCreateModel[]` (no `id`) for `Create` payloads — the
 * backend's model binder rejects an unknown `id` member on `TranslatableCreateModel` outright
 * (confirmed live: sending one 400s the whole request, not just that field). `asInfoTranslations`
 * tags those same two rows with `id: 0` for `Update` payloads, same convention as
 * `tourMapper.ts`'s `formToUpdateModel`: the backend's `ReconcileTranslations` (see
 * `PlaceUpdateService.cs` and its two siblings) matches by id, so `id: 0` always reads as
 * "replace this field's rows" — harmless because there is no unique constraint on
 * `(languageCode)` per entity and translation ids are never surfaced to the admin.
 */

import { LanguageCode } from '@/features/admin/lib/enums'
import type { Localized } from '@/features/admin/types/localized'
import type { TranslatableCreateModel, TranslatableInfoModel } from '@/shared/types/attours'

type AnyTranslation = { languageCode: number; value: string | null }
type TypedTranslation = AnyTranslation & { type: number }

export function readLocalized(translations: AnyTranslation[] | undefined): Localized {
  const find = (lang: number) =>
    (translations ?? []).find((t) => t.languageCode === lang)?.value ?? ''
  return { ru: find(LanguageCode.Russian), en: find(LanguageCode.English) }
}

/** Same as `readLocalized`, but also filters by `type` — needed for Region, the one entity in
 * this module whose translations actually carry a meaningful `type` (Name vs. Blurb). Using the
 * plain `readLocalized` on a region would pick whichever row matches the language first,
 * regardless of which field it belongs to. */
export function readLocalizedByType(translations: TypedTranslation[] | undefined, type: number): Localized {
  const find = (lang: number) =>
    (translations ?? []).find((t) => t.languageCode === lang && t.type === type)?.value ?? ''
  return { ru: find(LanguageCode.Russian), en: find(LanguageCode.English) }
}

/** Expand a `Localized` pair into its two wire rows — for `Create` payloads. */
export function writeLocalized(value: Localized): TranslatableCreateModel[] {
  return [
    { type: 0, languageCode: LanguageCode.Russian, value: value.ru },
    { type: 0, languageCode: LanguageCode.English, value: value.en },
  ]
}

/** Tag `writeLocalized`'s rows with `id: 0` — for `Update` payloads (see header comment). */
export function writeLocalizedForUpdate(value: Localized): TranslatableInfoModel[] {
  return writeLocalized(value).map((row) => ({ id: 0, ...row }))
}
