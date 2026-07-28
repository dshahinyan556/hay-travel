import { useEffect, useState } from 'react'
import { Input } from '@/shared/ui'
import type { GalleryItemFormState } from '@/features/admin/types/form'
import type { MoveDirection } from '@/features/admin/tour-form/reducer/tourFormReducer'
import { AddButton, RemoveButton, ReorderButtons } from './RepeaterControls'

interface GalleryImagesEditorProps {
  items: GalleryItemFormState[]
  onAdd: () => void
  onRemove: (key: string) => void
  onMove: (key: string, direction: MoveDirection) => void
  onChangeUrl: (key: string, value: string) => void
}

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
 * and reorder/remove controls; order maps to the backend `sortOrder`.
 */
export function GalleryImagesEditor({
  items,
  onAdd,
  onRemove,
  onMove,
  onChangeUrl,
}: GalleryImagesEditorProps) {
  return (
    <div className="flex flex-col gap-2">
      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((item, index) => (
            <li
              key={item.key}
              className="flex items-center gap-2.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2"
            >
              <ReorderButtons
                onMove={(direction) => onMove(item.key, direction)}
                canMoveUp={index > 0}
                canMoveDown={index < items.length - 1}
                itemNoun="картинку"
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
                className="flex-1 text-sm"
              />
              <RemoveButton onClick={() => onRemove(item.key)} label="Удалить картинку" />
            </li>
          ))}
        </ul>
      )}
      <AddButton onClick={onAdd}>Добавить картинку</AddButton>
    </div>
  )
}
