/**
 * Owns all form state and side effects for the create AND edit screens. Components receive
 * `state`, the bound `actions` API and derived `validation` as props — none of them touch the
 * reducer, the mapper or the network directly. `submit` maps the form to the wire DTO, sends it
 * (POST on create, PUT on edit) and navigates back to the dashboard on success; failures land
 * in `error` while `state` is kept so the user can retry without re-entering anything.
 *
 * The `mode` decides which endpoint runs. In edit mode the publish flag is synced separately:
 * `UpdateTour` deliberately ignores `isActive` (that is `SetActive`'s job), so when the admin
 * flips the "Активен" checkbox in the form we follow the update with a `setTourActive` call.
 */

/** Which lifecycle the form drives. `initialIsActive` lets edit detect a publish-flag change. */
export type TourFormMode =
  | { kind: 'create' }
  | { kind: 'edit'; tourId: number; initialIsActive: boolean }

import { useMemo, useReducer, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { createTour, setTourActive, updateTour } from '@/features/admin/api/adminTours'
import { formToCreateModel, formToUpdateModel } from '@/features/admin/lib/tourMapper'
import type { DaySourceContent } from '@/features/admin/lib/tourMapper'
import { ApiError } from '@/shared/lib/http'
import type { TourType } from '@/features/admin/lib/enums'
import type { Localized, TourFormState } from '@/features/admin/types/form'
import {
  normalizeInitialState,
  tourFormReducer,
} from '@/features/admin/tour-form/reducer/tourFormReducer'
import type {
  DayLocalizedField,
  LangKey,
  TourLocalizedField,
} from '@/features/admin/tour-form/reducer/tourFormReducer'
import { validateTourForm } from '@/features/admin/tour-form/lib/validation'
import type { TourFormValidation } from '@/features/admin/tour-form/lib/validation'

/**
 * Bound action creators — a thin, stable façade over `dispatch`.
 *
 * The `move*` members take a from/to index pair because reordering is drag-and-drop
 * (`shared/ui/SortableList` reports exactly that); nested lists still take the owning `dayKey`.
 */
export interface TourFormActions {
  setType: (value: TourType) => void
  setMainImageUrl: (value: string) => void
  setIsActive: (value: boolean) => void
  setRequiresPrepayment: (value: boolean) => void
  setLocalized: (field: TourLocalizedField, lang: LangKey, value: string) => void
  // days
  addDay: () => void
  removeDay: (dayKey: string) => void
  moveDay: (fromIndex: number, toIndex: number) => void
  setDayPrice: (dayKey: string, value: string) => void
  setDayLocalized: (dayKey: string, field: DayLocalizedField, lang: LangKey, value: string) => void
  // route points
  addRoutePoint: (dayKey: string) => void
  removeRoutePoint: (dayKey: string, key: string) => void
  moveRoutePoint: (dayKey: string, fromIndex: number, toIndex: number) => void
  setRoutePointText: (dayKey: string, key: string, lang: LangKey, value: string) => void
  setRoutePointPlace: (dayKey: string, key: string, placeId: number | null, text?: Localized) => void
  fillDayFromSource: (dayKey: string, content: DaySourceContent) => void
  // gallery
  addGallery: (dayKey: string) => void
  removeGallery: (dayKey: string, key: string) => void
  moveGallery: (dayKey: string, fromIndex: number, toIndex: number) => void
  setGalleryUrl: (dayKey: string, key: string, value: string) => void
  // organizational details
  addOrgDetail: () => void
  removeOrgDetail: (key: string) => void
  moveOrgDetail: (fromIndex: number, toIndex: number) => void
  setOrgDetailText: (key: string, lang: LangKey, value: string) => void
  // restrictions
  addRestriction: () => void
  removeRestriction: (key: string) => void
  moveRestriction: (fromIndex: number, toIndex: number) => void
  setRestrictionText: (key: string, lang: LangKey, value: string) => void
  // included
  addIncluded: () => void
  removeIncluded: (key: string) => void
  moveIncluded: (fromIndex: number, toIndex: number) => void
  setIncludedText: (key: string, lang: LangKey, value: string) => void
  // not included
  addNotIncluded: () => void
  removeNotIncluded: (key: string) => void
  moveNotIncluded: (fromIndex: number, toIndex: number) => void
  setNotIncludedText: (key: string, lang: LangKey, value: string) => void
  // expenses
  addExpense: () => void
  removeExpense: (key: string) => void
  setExpenseAmount: (key: string, value: string) => void
  setExpenseDescription: (key: string, lang: LangKey, value: string) => void
  // regions
  toggleRegion: (regionId: number) => void
}

export interface UseTourFormResult {
  state: TourFormState
  actions: TourFormActions
  validation: TourFormValidation
  /** True once the user has clicked "Сохранить" at least once — gates when field errors surface. */
  hasAttemptedSubmit: boolean
  submit: () => void
  isSubmitting: boolean
  error: string | null
  /** True once the form differs from what it was seeded with. Drives the unsaved-changes guard. */
  isDirty: boolean
}

/** Turn any thrown value from the save call into a user-facing Russian message. */
function submitErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return `Не удалось сохранить: сервер вернул ошибку (${error.status}). Данные формы сохранены — попробуйте ещё раз.`
  }
  return 'Не удалось сохранить: проверьте соединение и попробуйте ещё раз. Данные формы сохранены.'
}

/** Persist the form to the backend according to `mode`. Resolves once everything is saved. */
async function persist(state: TourFormState, mode: TourFormMode): Promise<void> {
  if (mode.kind === 'create') {
    await createTour(formToCreateModel(state))
    return
  }
  await updateTour(formToUpdateModel(state, mode.tourId))
  // UpdateTour ignores isActive — sync the publish flag only when the admin changed it.
  if (state.isActive !== mode.initialIsActive) {
    await setTourActive(mode.tourId, state.isActive)
  }
}

export function useTourForm(
  initialState: TourFormState,
  mode: TourFormMode = { kind: 'create' },
): UseTourFormResult {
  const navigate = useNavigate()
  const [state, dispatch] = useReducer(tourFormReducer, initialState, normalizeInitialState)
  // Snapshot of the normalized initial state, captured once on mount — never a dep of anything,
  // so later renders can't shift the baseline out from under `isDirty`.
  const baselineRef = useRef(state)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false)

  // `dispatch` is stable, so the bound API only needs to be built once.
  const actions = useMemo<TourFormActions>(
    () => ({
      setType: (value) => dispatch({ kind: 'setType', value }),
      setMainImageUrl: (value) => dispatch({ kind: 'setField', field: 'mainImageUrl', value }),
      setIsActive: (value) => dispatch({ kind: 'setField', field: 'isActive', value }),
      setRequiresPrepayment: (value) =>
        dispatch({ kind: 'setField', field: 'requiresPrepayment', value }),
      setLocalized: (field, lang, value) => dispatch({ kind: 'setLocalized', field, lang, value }),

      addDay: () => dispatch({ kind: 'addDay' }),
      removeDay: (dayKey) => dispatch({ kind: 'removeDay', dayKey }),
      moveDay: (fromIndex, toIndex) => dispatch({ kind: 'moveDay', fromIndex, toIndex }),
      setDayPrice: (dayKey, value) => dispatch({ kind: 'setDayPrice', dayKey, value }),
      setDayLocalized: (dayKey, field, lang, value) =>
        dispatch({ kind: 'setDayLocalized', dayKey, field, lang, value }),

      addRoutePoint: (dayKey) => dispatch({ kind: 'addRoutePoint', dayKey }),
      removeRoutePoint: (dayKey, key) => dispatch({ kind: 'removeRoutePoint', dayKey, key }),
      moveRoutePoint: (dayKey, fromIndex, toIndex) =>
        dispatch({ kind: 'moveRoutePoint', dayKey, fromIndex, toIndex }),
      setRoutePointText: (dayKey, key, lang, value) =>
        dispatch({ kind: 'setRoutePointText', dayKey, key, lang, value }),
      setRoutePointPlace: (dayKey, key, placeId, text) =>
        dispatch({ kind: 'setRoutePointPlace', dayKey, key, placeId, text }),
      fillDayFromSource: (dayKey, content) => dispatch({ kind: 'fillDayFromSource', dayKey, content }),

      addGallery: (dayKey) => dispatch({ kind: 'addGallery', dayKey }),
      removeGallery: (dayKey, key) => dispatch({ kind: 'removeGallery', dayKey, key }),
      moveGallery: (dayKey, fromIndex, toIndex) =>
        dispatch({ kind: 'moveGallery', dayKey, fromIndex, toIndex }),
      setGalleryUrl: (dayKey, key, value) => dispatch({ kind: 'setGalleryUrl', dayKey, key, value }),

      addOrgDetail: () => dispatch({ kind: 'addOrgDetail' }),
      removeOrgDetail: (key) => dispatch({ kind: 'removeOrgDetail', key }),
      moveOrgDetail: (fromIndex, toIndex) => dispatch({ kind: 'moveOrgDetail', fromIndex, toIndex }),
      setOrgDetailText: (key, lang, value) => dispatch({ kind: 'setOrgDetailText', key, lang, value }),

      addRestriction: () => dispatch({ kind: 'addRestriction' }),
      removeRestriction: (key) => dispatch({ kind: 'removeRestriction', key }),
      moveRestriction: (fromIndex, toIndex) => dispatch({ kind: 'moveRestriction', fromIndex, toIndex }),
      setRestrictionText: (key, lang, value) =>
        dispatch({ kind: 'setRestrictionText', key, lang, value }),

      addIncluded: () => dispatch({ kind: 'addIncluded' }),
      removeIncluded: (key) => dispatch({ kind: 'removeIncluded', key }),
      moveIncluded: (fromIndex, toIndex) => dispatch({ kind: 'moveIncluded', fromIndex, toIndex }),
      setIncludedText: (key, lang, value) => dispatch({ kind: 'setIncludedText', key, lang, value }),

      addNotIncluded: () => dispatch({ kind: 'addNotIncluded' }),
      removeNotIncluded: (key) => dispatch({ kind: 'removeNotIncluded', key }),
      moveNotIncluded: (fromIndex, toIndex) => dispatch({ kind: 'moveNotIncluded', fromIndex, toIndex }),
      setNotIncludedText: (key, lang, value) =>
        dispatch({ kind: 'setNotIncludedText', key, lang, value }),

      addExpense: () => dispatch({ kind: 'addExpense' }),
      removeExpense: (key) => dispatch({ kind: 'removeExpense', key }),
      setExpenseAmount: (key, value) => dispatch({ kind: 'setExpenseAmount', key, value }),
      setExpenseDescription: (key, lang, value) =>
        dispatch({ kind: 'setExpenseDescription', key, lang, value }),

      toggleRegion: (regionId) => dispatch({ kind: 'toggleRegion', regionId }),
    }),
    [],
  )

  // The form has no natural "diff" the way settings does (a handful of keyed fields) — it's a
  // deep tree of days/lists reshuffled by drag-and-drop, so a structural snapshot comparison is
  // simpler and just as correct than hand-rolling a walk over every nested list.
  const isDirty = useMemo(
    () => JSON.stringify(state) !== JSON.stringify(baselineRef.current),
    [state],
  )

  const rawValidation = useMemo(() => validateTourForm(state), [state])
  // Errors stay hidden until the first submit attempt — a blank required field shouldn't
  // greet the admin in red before they've had a chance to type anything. `isValid` itself
  // stays live throughout so the Save button is correctly disabled from the start.
  const validation = useMemo<TourFormValidation>(
    () =>
      hasAttemptedSubmit
        ? rawValidation
        : {
            isValid: rawValidation.isValid,
            dayTitleErrors: {},
            dayPriceErrors: {},
            dayRoutePointErrors: {},
          },
    [rawValidation, hasAttemptedSubmit],
  )

  function submit(): void {
    setHasAttemptedSubmit(true)
    if (isSubmitting || !rawValidation.isValid) return
    setIsSubmitting(true)
    setError(null)
    persist(state, mode)
      .then(() => navigate('/admin/products'))
      .catch((err: unknown) => {
        setError(submitErrorMessage(err))
        setIsSubmitting(false)
      })
  }

  return { state, actions, validation, hasAttemptedSubmit, submit, isSubmitting, error, isDirty }
}
