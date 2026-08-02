/**
 * Owns all state, the dirty diff and the network call of the settings screen. Components get
 * `state`, the bound `actions` and derived data as props — none of them touches the mapper or
 * the API.
 *
 * There is no reducer here (unlike the tour form) on purpose: the screen has no add, no remove
 * and no reordering, only edits to a known set of fields. Two operations do not justify an
 * action union.
 *
 * After a successful save the response of `Update` — which is the very same merged list
 * `GetAll` returns — becomes both the new state and the new baseline. `revalidate()` is
 * deliberately not called: it costs a round-trip and creates the classic trap where the loader
 * holds fresh data while the local state still holds the old one.
 */

import { useMemo, useState } from 'react'
import { updateSiteSettings } from '@/features/admin/api/adminSiteSettings'
import { ApiError } from '@/shared/lib/http'
import type { SiteSettingInfoModel } from '@/shared/types/attours'
import type { LangKey } from '@/features/admin/types/localized'
import type { SettingFieldState, SettingsFormState } from '@/features/admin/settings/types'
import { diffToUpdateModels, settingsToForm } from '@/features/admin/settings/lib/settingsMapper'
import { validateSettings } from '@/features/admin/settings/lib/validation'
import type { SettingsValidation } from '@/features/admin/settings/lib/validation'

/** Bound action creators — the only way a component changes a value. */
export interface SettingsFormActions {
  setValue: (key: string, value: string) => void
  setTranslation: (key: string, lang: LangKey, value: string) => void
}

export interface UseSettingsFormResult {
  state: SettingsFormState
  actions: SettingsFormActions
  /** Number of settings that differ from the baseline. 0 = nothing to save. */
  dirtyCount: number
  validation: SettingsValidation
  /** False while saving or while nothing changed. Stays true even if a required language is
   *  empty — `submit` itself no-ops on an invalid form and reveals the field errors instead, so
   *  a disabled button never hides *why* saving didn't happen (mirrors the tour form). */
  canSubmit: boolean
  /** True once the admin has tried to save at least once — gates when field errors surface. */
  hasAttemptedSubmit: boolean
  submit: () => void
  isSubmitting: boolean
  error: string | null
  /** Time of the last successful save — drives the «Сохранено в HH:MM» note. */
  savedAt: Date | null
}

/** `GlobalErrorCode.SiteSettingKeyUnknown` — the front's key set drifted from the catalog. */
const SITE_SETTING_KEY_UNKNOWN = 2005

/** Pull the backend error code out of an error body (`{ message, errorCode }`). */
function errorCodeOf(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const record = body as Record<string, unknown>
  const raw = record.errorCode ?? record.ErrorCode
  return typeof raw === 'number' ? raw : undefined
}

/** Turn any thrown value from the save call into a user-facing Russian message. */
function submitErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (errorCodeOf(error.body) === SITE_SETTING_KEY_UNKNOWN) {
      return 'Одна из настроек больше не поддерживается сервером — обновите страницу и попробуйте ещё раз.'
    }
    return `Не удалось сохранить: сервер вернул ошибку (${error.status}). Введённые значения сохранены — попробуйте ещё раз.`
  }
  return 'Не удалось сохранить: проверьте соединение и попробуйте ещё раз. Введённые значения сохранены.'
}

/** Immutably replace one field, leaving `sections` (and every other field) untouched. */
function patchField(
  state: SettingsFormState,
  key: string,
  patch: (field: SettingFieldState) => SettingFieldState,
): SettingsFormState {
  const field = state.fields[key]
  // A key that isn't in the response simply doesn't exist on this screen.
  if (!field) return state
  return { ...state, fields: { ...state.fields, [key]: patch(field) } }
}

export function useSettingsForm(initial: SiteSettingInfoModel[]): UseSettingsFormResult {
  const [state, setState] = useState<SettingsFormState>(() => settingsToForm(initial))
  // The last saved snapshot. `state.fields` is replaced wholesale on every edit, so holding the
  // initial object here is enough — it never mutates underneath us.
  const [baseline, setBaseline] = useState<Record<string, SettingFieldState>>(() => state.fields)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false)

  // `setState` is stable, so the bound API only needs to be built once.
  const actions = useMemo<SettingsFormActions>(
    () => ({
      setValue: (key, value) =>
        setState((prev) => patchField(prev, key, (field) => ({ ...field, value }))),
      setTranslation: (key, lang, value) =>
        setState((prev) =>
          patchField(prev, key, (field) => ({
            ...field,
            translations: { ...field.translations, [lang]: value },
          })),
        ),
    }),
    [],
  )

  const payload = useMemo(
    () => diffToUpdateModels(baseline, state.fields),
    [baseline, state.fields],
  )
  const rawValidation = useMemo(() => validateSettings(state.fields), [state.fields])
  // Errors stay hidden until the first submit attempt — a blank required field shouldn't greet
  // the admin in red before they've had a chance to type anything. `isValid` itself stays live
  // throughout so `submit` can correctly refuse to save from the very start (mirrors the tour
  // form's `useTourForm`).
  const validation = useMemo<SettingsValidation>(
    () =>
      hasAttemptedSubmit
        ? rawValidation
        : { ...rawValidation, errors: {}, missingCount: 0 },
    [rawValidation, hasAttemptedSubmit],
  )

  const dirtyCount = payload.length
  const canSubmit = !isSubmitting && dirtyCount > 0

  function submit(): void {
    setHasAttemptedSubmit(true)
    if (isSubmitting || dirtyCount === 0 || !rawValidation.isValid) return
    setIsSubmitting(true)
    setError(null)
    updateSiteSettings(payload)
      .then((merged) => {
        const next = settingsToForm(merged)
        setState(next)
        setBaseline(next.fields)
        setSavedAt(new Date())
      })
      .catch((err: unknown) => setError(submitErrorMessage(err)))
      .finally(() => setIsSubmitting(false))
  }

  return {
    state,
    actions,
    dirtyCount,
    validation,
    canSubmit,
    hasAttemptedSubmit,
    submit,
    isSubmitting,
    error,
    savedAt,
  }
}
