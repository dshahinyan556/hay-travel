/**
 * Canonical, comparable form of `TourFormState` for the dirty check (checklist 1.2).
 *
 * `useTourForm` used to compare `JSON.stringify(state)` with the baseline verbatim, which counted
 * bookkeeping that never reaches the server as an edit. The fields below are exactly the ones that
 * differ after a click that changes nothing the admin would recognise as a change:
 *
 *  - `key` — the client-only React/list id. Add a row and remove it again, or switch the type on
 *    create and back (the day list is rebuilt with fresh keys) — same content, different keys.
 *  - `serverId` — the id of the stored row. Uncheck a region/tag and check it again: the reducer
 *    re-adds it as a fresh entry without the join row's id (harmless on save, see
 *    `TourRegionFormState`), and a removed-then-retyped note is the same note.
 *  - `autofilledImageKeys` — session-only map of which gallery images a route point added; never
 *    sent (`TourDayFormState`).
 *  - regions/tags ORDER — both are unordered checkbox sets with no reorder UI, but a toggled-back
 *    item lands at the END of the array. Compared as sorted id lists.
 *  - start-time ORDER — the list is chronological by definition (re-sorted on blur), so the
 *    comparison uses the sorted times regardless of the row order at the moment.
 *
 * Everything else — every text, price, flag, list order the admin controls (days, route points,
 * gallery, notes, transfer stops) — is compared as is: if it differs from the baseline it IS a
 * change, and if it was edited back to the saved value it is not.
 */

import type { TourFormState } from '@/features/admin/types/form'

/** Keys dropped at any depth — client bookkeeping, not data. */
const BOOKKEEPING_KEYS = new Set(['key', 'serverId', 'autofilledImageKeys'])

function compareTimes(a: string, b: string): number {
  if (a === b) return 0
  if (a === '') return 1
  if (b === '') return -1
  return a < b ? -1 : 1
}

export function tourFormSnapshot(state: TourFormState): string {
  const comparable = {
    ...state,
    regions: state.regions.map((r) => r.regionId).sort((a, b) => a - b),
    tags: state.tags.map((t) => t.tagId).sort((a, b) => a - b),
    startTimes: state.startTimes.map((s) => s.time).sort(compareTimes),
  }
  return JSON.stringify(comparable, (name, value: unknown) =>
    BOOKKEEPING_KEYS.has(name) ? undefined : value,
  )
}
