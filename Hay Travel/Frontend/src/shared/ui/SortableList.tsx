import { useMemo } from 'react'
import type { ButtonHTMLAttributes, CSSProperties, ReactNode, Ref } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type {
  Announcements,
  DragEndEvent,
  DraggableAttributes,
  DraggableSyntheticListeners,
  ScreenReaderInstructions,
  UniqueIdentifier,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

/**
 * Mouse/touch/keyboard reorder primitive built on `@dnd-kit`. Replaces the old ▲/▼
 * `ReorderButtons` pattern (see `features/admin/ui/RepeaterControls.tsx`) with
 * drag-and-drop, without dictating row markup — this is the SAME mechanic behind two visually
 * different call sites:
 *  - catalog list tables, where a row is a `<tr>` and only a handle cell should be draggable;
 *  - tour-form repeaters, where a row is a `<li>` full of inputs, so dragging the whole row would
 *    fight click/focus on those inputs.
 *
 * `SortableList` renders no DOM element of its own (`DndContext`/`SortableContext` are plain
 * context providers), so it can be dropped straight inside a `<tbody>` or `<ul>` without breaking
 * table/list semantics. Each row is handed drag mechanics via a render-prop `children` callback —
 * the caller decides the tag, the visual states, and (critically) which element inside the row is
 * the actual drag handle. Wire that handle to `DragHandle` below, or a custom element that spreads
 * `attributes`/`listeners`/`setActivatorNodeRef` the same way.
 *
 * Sensors: `PointerSensor` covers mouse AND touch (native HTML5 `draggable` does not work on
 * touch, which is the whole reason this is dnd-kit and not a hand-rolled drag), with a small
 * activation distance so a plain tap/click on the handle doesn't get swallowed as a drag.
 * `KeyboardSensor` gives Tab-to-focus + Space to pick up + arrow keys to move + Space to drop +
 * Escape to cancel "for free" via dnd-kit's own `sortableKeyboardCoordinates`.
 *
 * Accessibility: reorder progress is announced through `DndContext`'s built-in `accessibility.
 * announcements` API (a portalled `aria-live` region dnd-kit manages itself) rather than a
 * hand-rolled live region — see `buildAnnouncements` below for the Russian copy.
 */

export interface SortableRowRenderProps {
  /** Ref for the row element itself (`<tr>`/`<li>`) — required for drag positioning/animation. */
  setNodeRef: (node: HTMLElement | null) => void
  /** Transform/transition to merge onto the row's `style` while dragging or settling back. */
  style: CSSProperties
  /** True while this row is the one currently being dragged — use for elevation/opacity/etc. */
  isDragging: boolean
  /** Spread onto the drag handle element together with `listeners` (see `DragHandle`). */
  attributes: DraggableAttributes
  listeners: DraggableSyntheticListeners
  /**
   * Ref for the drag handle element. Always wire this up (not `setNodeRef`) on the handle: it
   * lets dnd-kit measure the drag origin from the handle itself rather than the whole row, which
   * matters for keyboard reordering and for rows much larger than their handle.
   */
  setActivatorNodeRef: (node: HTMLElement | null) => void
}

export interface SortableListProps<T> {
  /** Items in current order. `SortableList` never mutates this — it only reports moves. */
  items: T[]
  /** Stable string id for an item, used both as the dnd-kit sortable id and for id/index lookup. */
  getId: (item: T) => string
  /**
   * Called once per completed move (mouse drop, touch drop, or keyboard drop) with the item's
   * old and new index. Apply it however fits the caller's state shape, e.g.
   * `arrayMove(items, activeIndex, overIndex)` from `@dnd-kit/sortable`, or a reducer action.
   */
  onReorder: (activeIndex: number, overIndex: number) => void
  /** Render-prop for one row: return the row's markup (`<tr>`/`<li>`/etc), wiring `sortable` in. */
  children: (item: T, index: number, sortable: SortableRowRenderProps) => ReactNode
  /**
   * Singular label for one row, used to build the keyboard-reorder `aria-live` announcements
   * (e.g. "Точка маршрута", "Строка справочника"). Defaults to a generic "Элемент".
   */
  itemLabel?: string
}

/** Row scope for `useSortable` — a component of its own because hooks can't run in a `.map`. */
function SortableRow({
  id,
  children,
}: {
  id: string
  children: (sortable: SortableRowRenderProps) => ReactNode
}) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id,
  })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
  }

  return children({ setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging, style })
}

const RU_SCREEN_READER_INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    'Чтобы взять элемент для перемещения, нажмите пробел или Enter. Пока элемент взят, ' +
    'перемещайте его стрелками вверх и вниз, затем нажмите пробел или Enter ещё раз, чтобы ' +
    'отпустить на новой позиции, либо Escape, чтобы отменить.',
}

function buildAnnouncements<T>(items: T[], getId: (item: T) => string, itemLabel: string): Announcements {
  const locate = (id: UniqueIdentifier) => {
    const index = items.findIndex((item) => getId(item) === String(id))
    return { index, total: items.length }
  }

  return {
    onDragStart({ active }) {
      const { index, total } = locate(active.id)
      if (index === -1) return undefined
      return `Начато перемещение: «${itemLabel}», позиция ${index + 1} из ${total}.`
    },
    onDragOver({ active, over }) {
      const { total } = locate(active.id)
      const targetIndex = over ? locate(over.id).index : locate(active.id).index
      if (targetIndex === -1) return undefined
      return `«${itemLabel}» перемещён на позицию ${targetIndex + 1} из ${total}.`
    },
    onDragEnd({ active, over }) {
      const { index, total } = locate(active.id)
      if (index === -1) return undefined
      if (!over) return `Перемещение отменено. «${itemLabel}» остался на позиции ${index + 1} из ${total}.`
      const overIndex = locate(over.id).index
      if (overIndex === -1) return undefined
      return `Перемещение завершено. «${itemLabel}» теперь на позиции ${overIndex + 1} из ${total}.`
    },
    onDragCancel({ active }) {
      const { index, total } = locate(active.id)
      if (index === -1) return undefined
      return `Перемещение отменено. «${itemLabel}» остался на позиции ${index + 1} из ${total}.`
    },
  }
}

export function SortableList<T>({ items, getId, onReorder, children, itemLabel = 'Элемент' }: SortableListProps<T>) {
  const sensors = useSensors(
    // A small activation distance keeps a plain click/tap on the handle (e.g. focusing it, or a
    // mis-timed tap) from being misread as a drag start.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const ids = useMemo(() => items.map(getId), [items, getId])
  const announcements = useMemo(() => buildAnnouncements(items, getId, itemLabel), [items, getId, itemLabel])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const activeIndex = items.findIndex((item) => getId(item) === String(active.id))
    const overIndex = items.findIndex((item) => getId(item) === String(over.id))
    if (activeIndex === -1 || overIndex === -1) return
    onReorder(activeIndex, overIndex)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: RU_SCREEN_READER_INSTRUCTIONS,
        // `SortableList` is meant to be dropped straight inside a `<tbody>` or `<ul>` (see file
        // header) — dnd-kit's own hidden instructions/live-region markup would otherwise land
        // there too and violate HTML content-model rules for those elements (only `<tr>`/`<li>`
        // may be direct children), which triggers a hydration mismatch and lets the browser's
        // HTML parser silently hoist the misplaced node out of the table/list. Portaling to
        // `document.body` keeps it out of the way regardless of where a caller mounts the list.
        container: document.body,
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {items.map((item, index) => (
          <SortableRow key={getId(item)} id={getId(item)}>
            {(sortable) => children(item, index, sortable)}
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  )
}

export interface DragHandleProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Overrides the default aria-label, e.g. to name the item being moved. */
  label?: string
  ref?: Ref<HTMLButtonElement>
}

/**
 * Default drag handle: a small grip-dots square button. Spread `attributes`/`listeners` from
 * `SortableRowRenderProps` onto it and pass `setActivatorNodeRef` as `ref`, e.g.:
 * `<DragHandle ref={sortable.setActivatorNodeRef} {...sortable.attributes} {...sortable.listeners} />`.
 *
 * `touch-none` (`touch-action: none`) is required, not decorative — without it, touch browsers
 * intercept the pointer for native scrolling before `PointerSensor` ever sees the drag start.
 */
export function DragHandle({ label = 'Перетащить, чтобы изменить порядок', className = '', ref, ...props }: DragHandleProps) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={`flex h-7 w-7 shrink-0 touch-none cursor-grab items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-400 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      {...props}
    >
      <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true" focusable="false">
        <circle cx="9" cy="6" r="1.6" />
        <circle cx="15" cy="6" r="1.6" />
        <circle cx="9" cy="12" r="1.6" />
        <circle cx="15" cy="12" r="1.6" />
        <circle cx="9" cy="18" r="1.6" />
        <circle cx="15" cy="18" r="1.6" />
      </svg>
    </button>
  )
}
