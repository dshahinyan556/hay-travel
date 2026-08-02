/**
 * Drag-and-drop reordering for the three CRUD catalog tabs (Places / Expense templates / Note
 * templates). Replaces the manual "Порядок сортировки" number field: the admin drags a row, the
 * new order is persisted immediately (David, 2026-08-01).
 *
 * The backend has no bulk-reorder endpoint — only `Update` per entry, each taking the FULL
 * `*InfoModel` — so one move fans out into one `Update` per row whose position actually changed
 * (`Promise.all`). Positions are always renumbered to a dense `0..n-1`, which keeps the stored
 * values honest even for legacy rows that all share `sortOrder: 0`.
 *
 * Order of the rendered list is owned here, NOT by the caller: the tabs render `rows`, which is
 * the loader data sorted by `sortOrder`, temporarily overridden by an optimistic order while the
 * updates are in flight. The optimistic copy is dropped as soon as the revalidated loader data
 * arrives (a fresh `items` array identity) — not right after `onMutated()`, which would flash the
 * old order for the duration of the refetch, and not "once the two agree", which would leave an
 * unsaved order on screen forever if they somehow never did. On failure it is dropped immediately
 * (rows snap back) and an error is surfaced through the tab's existing alert slot.
 */

import { useEffect, useMemo, useState } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import { catalogErrorMessage } from './catalogErrors'

/** Minimum shape a catalog row needs to take part in reordering. */
export interface SortableCatalogEntry {
  id: number
  sortOrder: number
}

/** Stable dnd-kit id for a catalog row — module-level so it keeps its identity across renders. */
export const catalogRowId = (item: SortableCatalogEntry): string => String(item.id)

/** `sortOrder` for a newly created entry: last position. The form no longer asks for it. */
export function nextSortOrder(items: readonly SortableCatalogEntry[]): number {
  if (items.length === 0) return 0
  return Math.max(...items.map((item) => item.sortOrder)) + 1
}

export interface UseCatalogReorderOptions<T extends SortableCatalogEntry> {
  /** Raw list from the loader, in whatever order the API returned it. */
  items: T[]
  /** `updatePlace` / `updateExpenseTemplate` / `updateTourNoteTemplate` — takes the full model. */
  update: (item: T) => Promise<unknown>
  /** Same callback the tab already passes to create/update/delete — revalidates the loader. */
  onMutated: () => void
  /** Verb phrase for `catalogErrorMessage`, e.g. `'изменить порядок точек'`. */
  errorAction: string
}

export interface CatalogReorder<T> {
  /** What the tab must render: sorted by `sortOrder`, optimistically reordered while saving. */
  rows: T[]
  /** True while the fan-out `Update` calls are in flight — drag handles are disabled meanwhile. */
  isSaving: boolean
  error: string | null
  /** Pass straight to `SortableList`'s `onReorder`. */
  reorder: (activeIndex: number, overIndex: number) => void
}

/** The order shown while updates are in flight, plus the `items` array it was derived from —
 * a fresh identity for `items` is what tells us the revalidated loader data has landed. */
interface OptimisticOrder<T> {
  rows: T[]
  source: T[]
  saved: boolean
}

export function useCatalogReorder<T extends SortableCatalogEntry>({
  items,
  update,
  onMutated,
  errorAction,
}: UseCatalogReorderOptions<T>): CatalogReorder<T> {
  const sorted = useMemo(() => [...items].sort((a, b) => a.sortOrder - b.sortOrder), [items])
  const [optimistic, setOptimistic] = useState<OptimisticOrder<T> | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rows = optimistic?.rows ?? sorted

  useEffect(() => {
    if (optimistic === null || !optimistic.saved) return
    if (items === optimistic.source) return // revalidation hasn't delivered fresh data yet
    setOptimistic(null) // hand ordering back to the server's truth
  }, [items, optimistic])

  function reorder(activeIndex: number, overIndex: number) {
    const moved = arrayMove(rows, activeIndex, overIndex)
    const renumbered = moved.map((item, index) => ({ ...item, sortOrder: index }))
    const changed = renumbered.filter((_, index) => moved[index].sortOrder !== index)
    if (changed.length === 0) return

    setOptimistic({ rows: renumbered, source: items, saved: false })
    setError(null)
    setIsSaving(true)
    Promise.all(changed.map(update))
      .then(() => {
        setOptimistic((current) => (current === null ? null : { ...current, saved: true }))
        onMutated()
      })
      .catch((err: unknown) => {
        setOptimistic(null)
        setError(catalogErrorMessage(err, errorAction))
      })
      .finally(() => setIsSaving(false))
  }

  return { rows, isSaving, error, reorder }
}
