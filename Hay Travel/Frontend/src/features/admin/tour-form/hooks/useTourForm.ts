/**
 * Owns all form state and side effects for the create AND edit screens. Components receive
 * `state`, the bound `actions` API and derived `validation` as props — none of them touch the
 * reducer, the mapper or the network directly. `submit` maps the form to the wire DTO, sends it
 * (POST on create, PUT on edit) and navigates back to the products list on success; failures land
 * in `error` while `state` is kept so the user can retry without re-entering anything.
 *
 * Two flags live in the draft but are NOT part of `CreateTour`/`UpdateTour`:
 *  - `isActive` on edit — `UpdateTour` ignores it (that is `SetActive`'s job), so a changed
 *    checkbox is followed by `setTourActive`;
 *  - `isFeatured` on create AND edit — the server ignores it in both payloads (`SetFeatured`'s
 *    job), so a changed checkbox is followed by `setTourFeatured`. That call can be refused with
 *    "already 9 featured" AFTER the product itself was saved; see `submit` for how each mode
 *    handles that partial success.
 * "Changed" is always measured against the baseline — the saved state the form was opened with.
 */

/** Which lifecycle the form drives. */
export type TourFormMode = { kind: 'create' } | { kind: 'edit'; tourId: number }

/** Router `state` the create screen hands to the edit screen when the product WAS created but
 * `SetFeatured` failed: the edit screen shows this text in its message slot. */
export interface TourSavedWithWarningState {
  saveWarning: string
}

/** Reads `TourSavedWithWarningState` out of an untyped `location.state`. */
export function readSaveWarning(state: unknown): string | null {
  if (typeof state !== 'object' || state === null) return null
  const value = (state as Record<string, unknown>).saveWarning
  return typeof value === 'string' ? value : null
}

import { useMemo, useReducer, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  MAX_FEATURED_TOURS,
  createTour,
  isTooManyFeaturedError,
  setTourActive,
  setTourFeatured,
  updateTour,
} from '@/features/admin/api/adminTours'
import { formToCreateModel, formToUpdateModel } from '@/features/admin/lib/tourMapper'
import type { DaySourceContent } from '@/features/admin/lib/tourMapper'
import { ApiError } from '@/shared/lib/http'
import type { TourFormat, TourType } from '@/features/admin/lib/enums'
import type { Localized, TourFormState } from '@/features/admin/types/form'
import {
  normalizeInitialState,
  tourFormReducer,
} from '@/features/admin/tour-form/reducer/tourFormReducer'
import type {
  DayLocalizedField,
  LangKey,
  TourLocalizedField,
  TransferEndpoint,
  TransferPriceField,
} from '@/features/admin/tour-form/reducer/tourFormReducer'
import { tourFormSnapshot } from '@/features/admin/tour-form/lib/formSnapshot'
import { validateTourForm } from '@/features/admin/tour-form/lib/validation'
import type { TourFormValidation } from '@/features/admin/tour-form/lib/validation'
import { useCopy } from '@/shared/i18n/defineCopy'
import { tourFormCopy } from '@/features/admin/tour-form/lib/tourFormCopy'
import type { TourFormCopy } from '@/features/admin/tour-form/lib/tourFormCopy'

/**
 * Bound action creators — a thin, stable façade over `dispatch`.
 *
 * The `move*` members take a from/to index pair because reordering is drag-and-drop
 * (`shared/ui/SortableList` reports exactly that); nested lists still take the owning `dayKey`.
 */
export interface TourFormActions {
  setType: (value: TourType) => void
  setFormat: (value: TourFormat) => void
  setGroupPricePerPerson: (value: string) => void
  setGroupCapacity: (value: string) => void
  setMainImageUrl: (value: string) => void
  setIsActive: (value: boolean) => void
  setIsFeatured: (value: boolean) => void
  setRequiresPrepayment: (value: boolean) => void
  setDiscountPercent: (value: string) => void
  setDiscountStartDate: (value: string) => void
  setDiscountValidUntil: (value: string) => void
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
  setRoutePointPlace: (
    dayKey: string,
    key: string,
    placeId: number | null,
    text?: Localized,
    images?: string[],
  ) => void
  fillDayFromSource: (
    dayKey: string,
    content: DaySourceContent,
    placeImages: Record<number, string[]>,
  ) => void
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
  // tags
  toggleTag: (tagId: number) => void
  // start times (tour/excursion). `sortStartTimes` is called on blur, not on every keystroke —
  // see the reducer's `setStartTime` case for why.
  addStartTime: () => void
  removeStartTime: (key: string) => void
  setStartTime: (key: string, value: string) => void
  sortStartTimes: () => void
  // transfer route
  setTransferEndpointText: (endpoint: TransferEndpoint, lang: LangKey, value: string) => void
  addTransferStop: () => void
  removeTransferStop: (key: string) => void
  moveTransferStop: (fromIndex: number, toIndex: number) => void
  setTransferStopText: (key: string, lang: LangKey, value: string) => void
  // transfer prices
  addTransferPrice: () => void
  removeTransferPrice: (key: string) => void
  setTransferPriceClass: (key: string, vehicleClassId: number | null) => void
  setTransferPriceAmount: (key: string, field: TransferPriceField, value: string) => void
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

/** Turn any thrown value from the save call into a user-facing message. Pure — the copy comes
 * from the hook, which is where the locale is known. */
function submitErrorMessage(copy: TourFormCopy['submitError'], error: unknown): string {
  return error instanceof ApiError ? copy.server(error.status) : copy.network
}

/** The product itself WAS saved, only `SetFeatured` failed — the message says so explicitly, so
 * the admin does not re-enter anything and knows exactly which part is missing. */
function featuredErrorMessage(copy: TourFormCopy['featuredError'], error: unknown): string {
  if (isTooManyFeaturedError(error)) return copy.tooMany(MAX_FEATURED_TOURS)
  return error instanceof ApiError ? copy.server(error.status) : copy.network
}

/** `SetFeatured` failed after the product itself was saved (see `submit`). Carries the original
 * error so the message can tell "the limit of 9 is reached" apart from a server/network failure. */
class FeaturedSyncError extends Error {
  /** What `setTourFeatured` actually threw. */
  readonly original: unknown
  /** The saved product — on create, the id the server has just assigned. */
  readonly tourId: number
  constructor(original: unknown, tourId: number) {
    super('SetFeatured failed after the product was saved')
    this.name = 'FeaturedSyncError'
    this.original = original
    this.tourId = tourId
  }
}

/** `setTourFeatured`, re-thrown as `FeaturedSyncError` so `submit` can tell this partial failure
 * apart from a failed save of the product itself. */
async function syncFeatured(tourId: number, isFeatured: boolean): Promise<void> {
  try {
    await setTourFeatured(tourId, isFeatured)
  } catch (err) {
    throw new FeaturedSyncError(err, tourId)
  }
}

/**
 * Persist the form to the backend according to `mode`. Resolves with the id of the saved product
 * once everything is saved. The two side flags are compared with `baseline` — the saved state —
 * so an unchanged checkbox costs no request.
 */
async function persist(state: TourFormState, baseline: TourFormState, mode: TourFormMode): Promise<number> {
  if (mode.kind === 'create') {
    const { id } = await createTour(formToCreateModel(state))
    // CreateTour takes `isActive` itself; only the featured flag needs a follow-up call.
    if (state.isFeatured) await syncFeatured(id, true)
    return id
  }
  await updateTour(formToUpdateModel(state, mode.tourId))
  // UpdateTour ignores isActive/isFeatured — sync each only when the admin changed it.
  if (state.isActive !== baseline.isActive) {
    await setTourActive(mode.tourId, state.isActive)
  }
  if (state.isFeatured !== baseline.isFeatured) {
    await syncFeatured(mode.tourId, state.isFeatured)
  }
  return mode.tourId
}

export function useTourForm(
  initialState: TourFormState,
  mode: TourFormMode = { kind: 'create' },
): UseTourFormResult {
  const navigate = useNavigate()
  const copy = useCopy(tourFormCopy)
  const [state, dispatch] = useReducer(tourFormReducer, initialState, normalizeInitialState)
  // The saved state the draft is compared against: the normalized initial state, captured on
  // mount. State rather than a ref because it moves exactly once — when an edit-mode save stored
  // the product but `SetFeatured` was refused (see `submit`); then everything but the featured
  // flag IS saved, and the form must stop calling those fields unsaved.
  const [baseline, setBaseline] = useState(state)
  const baselineSnapshot = useMemo(() => tourFormSnapshot(baseline), [baseline])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false)

  // `dispatch` is stable, so the bound API only needs to be built once.
  const actions = useMemo<TourFormActions>(
    () => ({
      setType: (value) => dispatch({ kind: 'setType', value }),
      setFormat: (value) => dispatch({ kind: 'setFormat', value }),
      setGroupPricePerPerson: (value) =>
        dispatch({ kind: 'setField', field: 'groupPricePerPerson', value }),
      setGroupCapacity: (value) => dispatch({ kind: 'setField', field: 'groupCapacity', value }),
      setMainImageUrl: (value) => dispatch({ kind: 'setField', field: 'mainImageUrl', value }),
      setIsActive: (value) => dispatch({ kind: 'setField', field: 'isActive', value }),
      setIsFeatured: (value) => dispatch({ kind: 'setField', field: 'isFeatured', value }),
      setRequiresPrepayment: (value) =>
        dispatch({ kind: 'setField', field: 'requiresPrepayment', value }),
      setDiscountPercent: (value) => dispatch({ kind: 'setField', field: 'discountPercent', value }),
      setDiscountStartDate: (value) =>
        dispatch({ kind: 'setField', field: 'discountStartDate', value }),
      setDiscountValidUntil: (value) =>
        dispatch({ kind: 'setField', field: 'discountValidUntil', value }),
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
      setRoutePointPlace: (dayKey, key, placeId, text, images) =>
        dispatch({ kind: 'setRoutePointPlace', dayKey, key, placeId, text, images }),
      fillDayFromSource: (dayKey, content, placeImages) =>
        dispatch({ kind: 'fillDayFromSource', dayKey, content, placeImages }),

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
      toggleTag: (tagId) => dispatch({ kind: 'toggleTag', tagId }),

      addStartTime: () => dispatch({ kind: 'addStartTime' }),
      removeStartTime: (key) => dispatch({ kind: 'removeStartTime', key }),
      setStartTime: (key, value) => dispatch({ kind: 'setStartTime', key, value }),
      sortStartTimes: () => dispatch({ kind: 'sortStartTimes' }),

      setTransferEndpointText: (endpoint, lang, value) =>
        dispatch({ kind: 'setTransferEndpointText', endpoint, lang, value }),
      addTransferStop: () => dispatch({ kind: 'addTransferStop' }),
      removeTransferStop: (key) => dispatch({ kind: 'removeTransferStop', key }),
      moveTransferStop: (fromIndex, toIndex) =>
        dispatch({ kind: 'moveTransferStop', fromIndex, toIndex }),
      setTransferStopText: (key, lang, value) =>
        dispatch({ kind: 'setTransferStopText', key, lang, value }),

      addTransferPrice: () => dispatch({ kind: 'addTransferPrice' }),
      removeTransferPrice: (key) => dispatch({ kind: 'removeTransferPrice', key }),
      setTransferPriceClass: (key, vehicleClassId) =>
        dispatch({ kind: 'setTransferPriceClass', key, vehicleClassId }),
      setTransferPriceAmount: (key, field, value) =>
        dispatch({ kind: 'setTransferPriceAmount', key, field, value }),
    }),
    [],
  )

  // The form has no natural "diff" the way settings does (a handful of keyed fields) — it's a
  // deep tree of days/lists reshuffled by drag-and-drop, so a structural snapshot comparison is
  // simpler and just as correct than hand-rolling a walk over every nested list. The snapshot is
  // the CANONICAL one (`tourFormSnapshot`): client bookkeeping (row keys, server ids, autofill
  // map) and the order of unordered sets are left out, so only a real change of data counts and
  // a value edited back to the saved one is not a change (checklist 1.2).
  const isDirty = useMemo(() => tourFormSnapshot(state) !== baselineSnapshot, [state, baselineSnapshot])

  // `copy.validation` is a stable object per locale (see `defineCopy`), so this only recomputes
  // on a real state change or a language switch.
  const rawValidation = useMemo(() => validateTourForm(state, copy.validation), [state, copy.validation])
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
            startTimeErrors: {},
            transferStopErrors: {},
            transferPriceErrors: {},
          },
    [rawValidation, hasAttemptedSubmit],
  )

  function submit(): void {
    setHasAttemptedSubmit(true)
    if (isSubmitting || !rawValidation.isValid) return
    setIsSubmitting(true)
    setError(null)
    const submitted = state
    persist(submitted, baseline, mode)
      .then(() => navigate('/admin/products'))
      .catch((err: unknown) => {
        if (err instanceof FeaturedSyncError) {
          const message = featuredErrorMessage(copy.featuredError, err.original)
          if (mode.kind === 'create') {
            // The product exists now. Staying on the create form would make a retry create it a
            // SECOND time — so the admin lands on the new product's card, where the warning is
            // shown and the featured checkbox can be retried as an ordinary edit.
            const warning: TourSavedWithWarningState = { saveWarning: message }
            navigate(`/admin/tours/${err.tourId}/edit`, { replace: true, state: warning })
            return
          }
          // Edit: everything but the featured flag is stored — move the baseline there, so the
          // form keeps exactly one unsaved change (the checkbox) instead of all of them.
          setBaseline({ ...submitted, isFeatured: baseline.isFeatured })
          setError(message)
          setIsSubmitting(false)
          return
        }
        setError(submitErrorMessage(copy.submitError, err))
        setIsSubmitting(false)
      })
  }

  return { state, actions, validation, hasAttemptedSubmit, submit, isSubmitting, error, isDirty }
}
