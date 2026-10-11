import { useState } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import { movedIds } from '../lib/productsModel'

/** What the admin did to the featured set since it was loaded: the full displayed order (rows
 * marked for removal keep their slot, greyed out, so «Вернуть» puts them back where they were)
 * and the ids marked «уберётся». */
interface FeaturedDraftState {
  order: number[]
  removed: number[]
}

export interface FeaturedDraft {
  /** Display order — every currently featured id, including the ones marked for removal. */
  order: number[]
  removed: ReadonlySet<number>
  /** Kept ids in their new order — what `ReorderFeatured` receives. */
  keptOrder: number[]
  /** Kept ids whose position is a real move (see `movedIds`) — drives the «перемещён» tag. */
  moved: ReadonlySet<number>
  /** Number of distinct edits: removals + moved products. 0 ⇔ the draft equals the saved state. */
  changeCount: number
  isDirty: boolean
  /** True when the kept products are no longer in their saved relative order — only then does a
   * save need `ReorderFeatured` at all. */
  isReordered: boolean
  reorder: (fromIndex: number, toIndex: number) => void
  remove: (id: number) => void
  restore: (id: number) => void
  reset: () => void
}

/**
 * Draft of the «Избранные» view: reorder by drag-and-drop, mark for removal / undo, nothing reaches
 * the server until Save. Dirty is measured against the SAVED order, not against "the admin touched
 * something": dragging a row away and back, or removing and restoring it, leaves no change.
 *
 * `savedIds` is the current featured set from the loader. The draft is reconciled with it on every
 * render instead of being reset by an effect: after a save (or a partially failed save) the loader
 * revalidates, ids that are no longer featured drop out of the draft, newly featured ones are
 * appended — and whatever the admin still has pending survives.
 */
export function useFeaturedDraft(savedIds: number[]): FeaturedDraft {
  const [draft, setDraft] = useState<FeaturedDraftState | null>(null)

  const savedSet = new Set(savedIds)
  const order = draft
    ? [...draft.order.filter((id) => savedSet.has(id)), ...savedIds.filter((id) => !draft.order.includes(id))]
    : savedIds
  const removed = new Set(draft ? draft.removed.filter((id) => savedSet.has(id)) : [])
  const keptOrder = order.filter((id) => !removed.has(id))
  const keptSaved = savedIds.filter((id) => !removed.has(id))
  const moved = movedIds(keptSaved, keptOrder)
  const changeCount = removed.size + moved.size

  function update(next: (current: FeaturedDraftState) => FeaturedDraftState): void {
    setDraft(next({ order, removed: [...removed] }))
  }

  return {
    order,
    removed,
    keptOrder,
    moved,
    changeCount,
    isDirty: changeCount > 0,
    isReordered: moved.size > 0,
    reorder: (fromIndex, toIndex) =>
      update((current) => ({ ...current, order: arrayMove(current.order, fromIndex, toIndex) })),
    remove: (id) =>
      update((current) =>
        current.removed.includes(id) ? current : { ...current, removed: [...current.removed, id] },
      ),
    restore: (id) => update((current) => ({ ...current, removed: current.removed.filter((r) => r !== id) })),
    reset: () => setDraft(null),
  }
}
