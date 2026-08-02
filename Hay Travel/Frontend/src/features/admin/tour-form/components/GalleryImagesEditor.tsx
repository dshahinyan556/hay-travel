import { useEffect, useState } from 'react'
import { DragHandle, Input, SortableList } from '@/shared/ui'
import type { GalleryItemFormState } from '@/features/admin/types/form'
import { AddButton, RemoveButton } from './RepeaterControls'

interface GalleryImagesEditorProps {
  items: GalleryItemFormState[]
  onAdd: () => void
  onRemove: (key: string) => void
  /** Drag-and-drop reorder: move the image at `fromIndex` to `toIndex`. */
  onReorder: (fromIndex: number, toIndex: number) => void
  onChangeUrl: (key: string, value: string) => void
}

/** Stable identity for the drag list — rows are addressed by their form key, never by index. */
const imageId = (item: GalleryItemFormState): string => item.key

/** Small thumbnail beside a gallery row; falls back to a placeholder on empty/broken URL. */
function Thumb({ url }: { url: string }) {
  const trimmed = url.trim()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [trimmed])

  if (trimmed === '' || failed) {
    return (
      <span
        aria-hidden="true"
        className="h-8 w-11 shrink-0 rounded-md bg-gradient-to-br from-neutral-200 to-neutral-300"
      />
    )
  }

  return (
    <img
      src={trimmed}
      alt=""
      className="h-8 w-11 shrink-0 rounded-md object-cover"
      onError={() => setFailed(true)}
    />
  )
}

/**
 * Repeater for a day's gallery image URLs. Each row shows a preview thumbnail, the URL input
 * and a remove button; order maps to the backend `sortOrder` and is changed by dragging the
 * row's handle (the row itself stays clickable — it holds the URL input).
 */
export function GalleryImagesEditor({
  items,
  onAdd,
  onRemove,
  onReorder,
  onChangeUrl,
}: GalleryImagesEditorProps) {
  return (
    <div className="flex flex-col gap-2">
      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          <SortableList items={items} getId={imageId} onReorder={onReorder} itemLabel="Картинка">
            {(item, index, sortable) => (
              <li
                ref={sortable.setNodeRef}
                style={sortable.style}
                className={`relative flex items-center gap-2 rounded-lg border bg-neutral-50 px-2 py-2 sm:gap-2.5 sm:px-2.5 ${
                  sortable.isDragging ? 'z-10 border-brand-300 shadow-md' : 'border-neutral-200'
                }`}
              >
                <DragHandle
                  ref={sortable.setActivatorNodeRef}
                  {...sortable.attributes}
                  {...sortable.listeners}
                  label={`Перетащить картинку ${index + 1}, чтобы изменить порядок`}
                />
                <span className="w-4 shrink-0 text-center text-xs tabular-nums text-neutral-400">
                  {index + 1}
                </span>
                <Thumb url={item.url} />
                <Input
                  value={item.url}
                  onChange={(e) => onChangeUrl(item.key, e.target.value)}
                  aria-label={`Ссылка на картинку ${index + 1}`}
                  placeholder="https://…"
                  className="min-w-0 flex-1 text-sm"
                />
                <RemoveButton onClick={() => onRemove(item.key)} label="Удалить картинку" />
              </li>
            )}
          </SortableList>
        </ul>
      )}
      <AddButton onClick={onAdd}>Добавить картинку</AddButton>
    </div>
  )
}
