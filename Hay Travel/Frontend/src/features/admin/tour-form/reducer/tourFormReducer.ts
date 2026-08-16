/**
 * Pure reducer for the tour/excursion create form.
 *
 * All form mutations flow through here as a discriminated union of actions — components never
 * mutate state directly, they only dispatch. Every update is immutable and addresses list
 * items by their stable `key` (never by array index), so React keys stay valid across
 * reorders and removals. The one deliberate exception is reordering: drag-and-drop
 * (`shared/ui/SortableList`) reports a move as a from/to index pair, so the `move*` actions
 * carry indices — a nested list still uses `dayKey` to locate the day that owns it.
 *
 * The domain rule about day count lives here, not in components:
 *  - Excursion = exactly one day (add/remove are no-ops, the UI hides the buttons).
 *  - Tour = at least two days (one overnight). Switching to Excursion truncates to one day;
 *    switching to Tour tops the list up to two.
 */

import { arrayMove } from '@dnd-kit/sortable'
import { TourType } from '@/features/admin/lib/enums'
import { emptyDay, emptyExpense, emptyLocalizedItem, emptyGalleryItem } from '@/features/admin/lib/tourMapper'
import type {
  Localized,
  LocalizedListItem,
  TourDayFormState,
  TourFormState,
} from '@/features/admin/types/form'
import type { LangKey } from '@/features/admin/types/localized'

/** `LangKey` now lives in `types/localized.ts` — it is shared with the settings screen
 * (ADR 004). Re-exported here so every existing import from this reducer keeps working. */
export type { LangKey }

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
  | { kind: 'setField'; field: 'requiresPrepayment'; value: boolean }
  | { kind: 'setLocalized'; field: TourLocalizedField; lang: LangKey; value: string }
  // days
  | { kind: 'addDay' }
  | { kind: 'removeDay'; dayKey: string }
  | { kind: 'moveDay'; fromIndex: number; toIndex: number }
  | { kind: 'setDayPrice'; dayKey: string; value: string }
  | { kind: 'setDayLocalized'; dayKey: string; field: DayLocalizedField; lang: LangKey; value: string }
  // route points (of a day)
  | { kind: 'addRoutePoint'; dayKey: string }
  | { kind: 'removeRoutePoint'; dayKey: string; key: string }
  | { kind: 'moveRoutePoint'; dayKey: string; fromIndex: number; toIndex: number }
  | { kind: 'setRoutePointText'; dayKey: string; key: string; lang: LangKey; value: string }
  // gallery (of a day)
  | { kind: 'addGallery'; dayKey: string }
  | { kind: 'removeGallery'; dayKey: string; key: string }
  | { kind: 'moveGallery'; dayKey: string; fromIndex: number; toIndex: number }
  | { kind: 'setGalleryUrl'; dayKey: string; key: string; value: string }
  // organizational details (tour-level list)
  | { kind: 'addOrgDetail' }
  | { kind: 'removeOrgDetail'; key: string }
  | { kind: 'moveOrgDetail'; fromIndex: number; toIndex: number }
  | { kind: 'setOrgDetailText'; key: string; lang: LangKey; value: string }
  // restrictions (tour-level list)
  | { kind: 'addRestriction' }
  | { kind: 'removeRestriction'; key: string }
  | { kind: 'moveRestriction'; fromIndex: number; toIndex: number }
  | { kind: 'setRestrictionText'; key: string; lang: LangKey; value: string }
  // included (tour-level list — "Включено")
  | { kind: 'addIncluded' }
  | { kind: 'removeIncluded'; key: string }
  | { kind: 'moveIncluded'; fromIndex: number; toIndex: number }
  | { kind: 'setIncludedText'; key: string; lang: LangKey; value: string }
  // not included (tour-level list — "Не включено")
  | { kind: 'addNotIncluded' }
  | { kind: 'removeNotIncluded'; key: string }
  | { kind: 'moveNotIncluded'; fromIndex: number; toIndex: number }
  | { kind: 'setNotIncludedText'; key: string; lang: LangKey; value: string }
  // additional expenses (tour-level list, unordered)
  | { kind: 'addExpense' }
  | { kind: 'removeExpense'; key: string }
  | { kind: 'setExpenseAmount'; key: string; value: string }
  | { kind: 'setExpenseDescription'; key: string; lang: LangKey; value: string }
  // regions (tour-level, unordered checkbox set)
  | { kind: 'toggleRegion'; regionId: number }
  // tags (tour-level, unordered checkbox set). Dumb toggle only — the max-3/max-1-discount
  // rule needs the tag catalog's `type` per id, which the reducer doesn't have; that
  // enforcement (block + message) lives in `TagPicker`, the same layering `RegionPicker` uses
  // for its own (looser) rule.
  | { kind: 'toggleTag'; tagId: number }

/* -------------------------------------------------------------------------- */
/*  Immutable list helpers                                                     */
/* -------------------------------------------------------------------------- */

type Keyed = { key: string }

const updateByKey = <T extends Keyed>(list: T[], key: string, fn: (item: T) => T): T[] =>
  list.map((item) => (item.key === key ? fn(item) : item))

const removeByKey = <T extends Keyed>(list: T[], key: string): T[] =>
  list.filter((item) => item.key !== key)

/**
 * Move an item to an arbitrary position (not just to a neighbour) — drag-and-drop can drop the
 * first row straight at the end. Out-of-range or no-op indices leave the list untouched, so a
 * stale index from a list that changed mid-drag can never corrupt state.
 */
const reorder = <T>(list: T[], fromIndex: number, toIndex: number): T[] => {
  if (fromIndex === toIndex) return list
  const isInRange = (i: number) => Number.isInteger(i) && i >= 0 && i < list.length
  if (!isInRange(fromIndex) || !isInRange(toIndex)) return list
  return arrayMove(list, fromIndex, toIndex)
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
      if (action.field === 'mainImageUrl') return { ...state, mainImageUrl: action.value }
      if (action.field === 'isActive') return { ...state, isActive: action.value }
      return { ...state, requiresPrepayment: action.value }

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
      return { ...state, days: reorder(state.days, action.fromIndex, action.toIndex) }

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
        routePoints: reorder(day.routePoints, action.fromIndex, action.toIndex),
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
        gallery: reorder(day.gallery, action.fromIndex, action.toIndex),
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
        organizationalDetails: reorder(state.organizationalDetails, action.fromIndex, action.toIndex),
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
      return { ...state, restrictions: reorder(state.restrictions, action.fromIndex, action.toIndex) }

    case 'setRestrictionText':
      return {
        ...state,
        restrictions: setItemText(state.restrictions, action.key, action.lang, action.value),
      }

    /* ---- included ("Включено") ---- */
    case 'addIncluded':
      return { ...state, included: [...state.included, emptyLocalizedItem()] }

    case 'removeIncluded':
      return { ...state, included: removeByKey(state.included, action.key) }

    case 'moveIncluded':
      return { ...state, included: reorder(state.included, action.fromIndex, action.toIndex) }

    case 'setIncludedText':
      return {
        ...state,
        included: setItemText(state.included, action.key, action.lang, action.value),
      }

    /* ---- not included ("Не включено") ---- */
    case 'addNotIncluded':
      return { ...state, notIncluded: [...state.notIncluded, emptyLocalizedItem()] }

    case 'removeNotIncluded':
      return { ...state, notIncluded: removeByKey(state.notIncluded, action.key) }

    case 'moveNotIncluded':
      return { ...state, notIncluded: reorder(state.notIncluded, action.fromIndex, action.toIndex) }

    case 'setNotIncludedText':
      return {
        ...state,
        notIncluded: setItemText(state.notIncluded, action.key, action.lang, action.value),
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

    /* ---- regions ---- */
    case 'toggleRegion': {
      const isSelected = state.regions.some((r) => r.regionId === action.regionId)
      return {
        ...state,
        // Turning a region back on after unchecking it starts a fresh entry (no `serverId`) —
        // see `TourRegionFormState`'s doc comment for why that's harmless on save.
        regions: isSelected
          ? state.regions.filter((r) => r.regionId !== action.regionId)
          : [...state.regions, { regionId: action.regionId }],
      }
    }

    /* ---- tags ---- */
    case 'toggleTag': {
      const isSelected = state.tags.some((tg) => tg.tagId === action.tagId)
      return {
        ...state,
        tags: isSelected
          ? state.tags.filter((tg) => tg.tagId !== action.tagId)
          : [...state.tags, { tagId: action.tagId }],
      }
    }
  }
}
