/**
 * Pure reducer for the tour/excursion create form.
 *
 * All form mutations flow through here as a discriminated union of actions — components never
 * mutate state directly, they only dispatch. Every update is immutable and addresses list
 * items by their stable `key` (never by array index), so React keys stay valid across
 * reorders and removals.
 *
 * The domain rule about day count lives here, not in components:
 *  - Excursion = exactly one day (add/remove are no-ops, the UI hides the buttons).
 *  - Tour = at least two days (one overnight). Switching to Excursion truncates to one day;
 *    switching to Tour tops the list up to two.
 */

import { TourType } from '@/features/admin/lib/enums'
import { emptyDay, emptyExpense, emptyLocalizedItem, emptyGalleryItem } from '@/features/admin/lib/tourMapper'
import type {
  Localized,
  LocalizedListItem,
  TourDayFormState,
  TourFormState,
} from '@/features/admin/types/form'

/** The two languages every localized field carries. */
export type LangKey = 'ru' | 'en'

/** Direction for reordering an item within its ordered list. */
export type MoveDirection = 'up' | 'down'

/** Tour-level localized fields (each is a `Localized { ru, en }` pair). */
export type TourLocalizedField = 'title' | 'shortDescription' | 'description' | 'duration'

/** A day's localized fields — same set as the tour, but scoped to one day. */
export type DayLocalizedField = 'title' | 'shortDescription' | 'description' | 'duration'

/** Minimum number of days a Tour (as opposed to an Excursion) must have. */
export const MIN_TOUR_DAYS = 2

/* -------------------------------------------------------------------------- */
/*  Actions                                                                    */
/* -------------------------------------------------------------------------- */

export type TourFormAction =
  // top-level
  | { kind: 'setType'; value: TourType }
  | { kind: 'setField'; field: 'mainImageUrl'; value: string }
  | { kind: 'setField'; field: 'isActive'; value: boolean }
  | { kind: 'setLocalized'; field: TourLocalizedField; lang: LangKey; value: string }
  // days
  | { kind: 'addDay' }
  | { kind: 'removeDay'; dayKey: string }
  | { kind: 'moveDay'; dayKey: string; direction: MoveDirection }
  | { kind: 'setDayPrice'; dayKey: string; value: string }
  | { kind: 'setDayLocalized'; dayKey: string; field: DayLocalizedField; lang: LangKey; value: string }
  // route points (of a day)
  | { kind: 'addRoutePoint'; dayKey: string }
  | { kind: 'removeRoutePoint'; dayKey: string; key: string }
  | { kind: 'moveRoutePoint'; dayKey: string; key: string; direction: MoveDirection }
  | { kind: 'setRoutePointText'; dayKey: string; key: string; lang: LangKey; value: string }
  // gallery (of a day)
  | { kind: 'addGallery'; dayKey: string }
  | { kind: 'removeGallery'; dayKey: string; key: string }
  | { kind: 'moveGallery'; dayKey: string; key: string; direction: MoveDirection }
  | { kind: 'setGalleryUrl'; dayKey: string; key: string; value: string }
  // organizational details (tour-level list)
  | { kind: 'addOrgDetail' }
  | { kind: 'removeOrgDetail'; key: string }
  | { kind: 'moveOrgDetail'; key: string; direction: MoveDirection }
  | { kind: 'setOrgDetailText'; key: string; lang: LangKey; value: string }
  // restrictions (tour-level list)
  | { kind: 'addRestriction' }
  | { kind: 'removeRestriction'; key: string }
  | { kind: 'moveRestriction'; key: string; direction: MoveDirection }
  | { kind: 'setRestrictionText'; key: string; lang: LangKey; value: string }
  // additional expenses (tour-level list, unordered)
  | { kind: 'addExpense' }
  | { kind: 'removeExpense'; key: string }
  | { kind: 'setExpenseAmount'; key: string; value: string }
  | { kind: 'setExpenseDescription'; key: string; lang: LangKey; value: string }

/* -------------------------------------------------------------------------- */
/*  Immutable list helpers                                                     */
/* -------------------------------------------------------------------------- */

type Keyed = { key: string }

const updateByKey = <T extends Keyed>(list: T[], key: string, fn: (item: T) => T): T[] =>
  list.map((item) => (item.key === key ? fn(item) : item))

const removeByKey = <T extends Keyed>(list: T[], key: string): T[] =>
  list.filter((item) => item.key !== key)

/** Swap an item with its neighbour in the given direction; no-op at the list edges. */
const moveByKey = <T extends Keyed>(list: T[], key: string, direction: MoveDirection): T[] => {
  const index = list.findIndex((item) => item.key === key)
  if (index === -1) return list
  const target = direction === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= list.length) return list
  const next = [...list]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

/** Set one language of a `Localized` pair, leaving the other language untouched. */
const setLoc = (loc: Localized, lang: LangKey, value: string): Localized => ({ ...loc, [lang]: value })

/** Update the text of one item in a `LocalizedListItem[]`. */
const setItemText = (
  list: LocalizedListItem[],
  key: string,
  lang: LangKey,
  value: string,
): LocalizedListItem[] => updateByKey(list, key, (item) => ({ ...item, text: setLoc(item.text, lang, value) }))

/** Apply a transform to a single day, addressed by key. */
const updateDay = (
  state: TourFormState,
  dayKey: string,
  fn: (day: TourDayFormState) => TourDayFormState,
): TourFormState => ({ ...state, days: updateByKey(state.days, dayKey, fn) })

/* -------------------------------------------------------------------------- */
/*  Day-count domain rule                                                      */
/* -------------------------------------------------------------------------- */

/** Coerce the day list to satisfy the rule for `type` (see file header). */
export function applyDayRule(days: TourDayFormState[], type: TourType): TourDayFormState[] {
  if (type === TourType.Excursion) {
    return days.length === 1 ? days : days.length === 0 ? [emptyDay()] : [days[0]]
  }
  if (days.length >= MIN_TOUR_DAYS) return days
  const next = [...days]
  while (next.length < MIN_TOUR_DAYS) next.push(emptyDay())
  return next
}

/** Normalize a freshly built form so its day count already matches its type. Used as the
 * `useReducer` lazy initializer so the initial render is never in an invalid day-count state. */
export function normalizeInitialState(state: TourFormState): TourFormState {
  const days = applyDayRule(state.days, state.type)
  return days === state.days ? state : { ...state, days }
}

/** The smallest legal day count for the current type. */
export function minDaysFor(type: TourType): number {
  return type === TourType.Excursion ? 1 : MIN_TOUR_DAYS
}

/* -------------------------------------------------------------------------- */
/*  Reducer                                                                    */
/* -------------------------------------------------------------------------- */

export function tourFormReducer(state: TourFormState, action: TourFormAction): TourFormState {
  switch (action.kind) {
    case 'setType': {
      if (action.value === state.type) return state
      return { ...state, type: action.value, days: applyDayRule(state.days, action.value) }
    }

    case 'setField':
      return action.field === 'mainImageUrl'
        ? { ...state, mainImageUrl: action.value }
        : { ...state, isActive: action.value }

    case 'setLocalized':
      return { ...state, [action.field]: setLoc(state[action.field], action.lang, action.value) }

    /* ---- days ---- */
    case 'addDay':
      if (state.type === TourType.Excursion) return state
      return { ...state, days: [...state.days, emptyDay()] }

    case 'removeDay': {
      if (state.days.length <= minDaysFor(state.type)) return state
      return { ...state, days: removeByKey(state.days, action.dayKey) }
    }

    case 'moveDay':
      return { ...state, days: moveByKey(state.days, action.dayKey, action.direction) }

    case 'setDayPrice':
      return updateDay(state, action.dayKey, (day) => ({ ...day, price: action.value }))

    case 'setDayLocalized':
      return updateDay(state, action.dayKey, (day) => ({
        ...day,
        [action.field]: setLoc(day[action.field], action.lang, action.value),
      }))

    /* ---- route points ---- */
    case 'addRoutePoint':
      return updateDay(state, action.dayKey, (day) => ({
        ...day,
        routePoints: [...day.routePoints, emptyLocalizedItem()],
      }))

    case 'removeRoutePoint':
      return updateDay(state, action.dayKey, (day) => ({
        ...day,
        routePoints: removeByKey(day.routePoints, action.key),
      }))

    case 'moveRoutePoint':
      return updateDay(state, action.dayKey, (day) => ({
        ...day,
        routePoints: moveByKey(day.routePoints, action.key, action.direction),
      }))

    case 'setRoutePointText':
      return updateDay(state, action.dayKey, (day) => ({
        ...day,
        routePoints: setItemText(day.routePoints, action.key, action.lang, action.value),
      }))

    /* ---- gallery ---- */
    case 'addGallery':
      return updateDay(state, action.dayKey, (day) => ({
        ...day,
        gallery: [...day.gallery, emptyGalleryItem()],
      }))

    case 'removeGallery':
      return updateDay(state, action.dayKey, (day) => ({
        ...day,
        gallery: removeByKey(day.gallery, action.key),
      }))

    case 'moveGallery':
      return updateDay(state, action.dayKey, (day) => ({
        ...day,
        gallery: moveByKey(day.gallery, action.key, action.direction),
      }))

    case 'setGalleryUrl':
      return updateDay(state, action.dayKey, (day) => ({
        ...day,
        gallery: updateByKey(day.gallery, action.key, (g) => ({ ...g, url: action.value })),
      }))

    /* ---- organizational details ---- */
    case 'addOrgDetail':
      return { ...state, organizationalDetails: [...state.organizationalDetails, emptyLocalizedItem()] }

    case 'removeOrgDetail':
      return { ...state, organizationalDetails: removeByKey(state.organizationalDetails, action.key) }

    case 'moveOrgDetail':
      return {
        ...state,
        organizationalDetails: moveByKey(state.organizationalDetails, action.key, action.direction),
      }

    case 'setOrgDetailText':
      return {
        ...state,
        organizationalDetails: setItemText(state.organizationalDetails, action.key, action.lang, action.value),
      }

    /* ---- restrictions ---- */
    case 'addRestriction':
      return { ...state, restrictions: [...state.restrictions, emptyLocalizedItem()] }

    case 'removeRestriction':
      return { ...state, restrictions: removeByKey(state.restrictions, action.key) }

    case 'moveRestriction':
      return { ...state, restrictions: moveByKey(state.restrictions, action.key, action.direction) }

    case 'setRestrictionText':
      return {
        ...state,
        restrictions: setItemText(state.restrictions, action.key, action.lang, action.value),
      }

    /* ---- additional expenses ---- */
    case 'addExpense':
      return { ...state, additionalExpenses: [...state.additionalExpenses, emptyExpense()] }

    case 'removeExpense':
      return { ...state, additionalExpenses: removeByKey(state.additionalExpenses, action.key) }

    case 'setExpenseAmount':
      return {
        ...state,
        additionalExpenses: updateByKey(state.additionalExpenses, action.key, (e) => ({
          ...e,
          amount: action.value,
        })),
      }

    case 'setExpenseDescription':
      return {
        ...state,
        additionalExpenses: updateByKey(state.additionalExpenses, action.key, (e) => ({
          ...e,
          description: setLoc(e.description, action.lang, action.value),
        })),
      }
  }
}
