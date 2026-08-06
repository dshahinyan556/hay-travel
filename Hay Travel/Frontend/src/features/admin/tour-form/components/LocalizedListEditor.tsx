import { DragHandle, SortableList, SuggestInput } from '@/shared/ui'
import type { Localized, LocalizedListItem } from '@/features/admin/types/form'
import type { LangKey } from '@/features/admin/tour-form/reducer/tourFormReducer'
import { AddButton, RemoveButton } from '@/features/admin/ui/RepeaterControls'

interface LocalizedListEditorProps {
  /** Section heading, e.g. "Точки маршрута". */
  title: string
  /** Helper text under the heading. */
  hint?: string
  /** Message shown in place of rows when the list is empty. */
  emptyText: string
  /** Text for the add button, e.g. "Добавить точку". */
  addLabel: string
  /** Singular noun (accusative) for a11y labels, e.g. "точку" → "Удалить точку". */
  itemNoun: string
  /**
   * Singular noun (nominative) for the drag `aria-live` announcements, e.g. "Точка маршрута".
   * Falls back to `itemNoun` when the two forms coincide.
   */
  itemLabel?: string
  /** Blocking error for the whole list (e.g. "add at least one route point"). */
  error?: string
  items: LocalizedListItem[]
  /** Existing catalog entries offered as autocomplete while typing RU/EN — picking one fills
   * both languages at once, the text stays freely editable afterwards. Omit to show no suggestions. */
  suggestions?: Localized[]
  onAdd: () => void
  onRemove: (key: string) => void
  /** Drag-and-drop reorder: move the item at `fromIndex` to `toIndex`. */
  onReorder: (fromIndex: number, toIndex: number) => void
  onChangeText: (key: string, lang: LangKey, value: string) => void
}

/** Stable identity for the drag list — rows are addressed by their form key, never by index. */
const itemId = (item: LocalizedListItem): string => item.key

/**
 * Shared repeater for any ordered list of a single bilingual text — route points,
 * organizational details and restrictions all use it. One implementation, three call sites:
 * a compact RU | EN row per item with a drag handle and a remove button, plus an add button.
 * Order is meaningful (mapped to the backend `sortOrder`), hence the drag-to-reorder handle —
 * dragging is bound to the handle only, since the rest of the row is text inputs.
 */
export function LocalizedListEditor({
  title,
  hint,
  emptyText,
  addLabel,
  itemNoun,
  itemLabel,
  error,
  items,
  suggestions,
  onAdd,
  onRemove,
  onReorder,
  onChangeText,
}: LocalizedListEditorProps) {
  const ruSuggestions = suggestions?.map((s) => s.ru).filter(Boolean) ?? []
  const enSuggestions = suggestions?.map((s) => s.en).filter(Boolean) ?? []
  const pickSuggestion = (key: string, label: string, lang: LangKey) => {
    const match = suggestions?.find((s) => s[lang] === label)
    if (!match) return
    onChangeText(key, 'ru', match.ru)
    onChangeText(key, 'en', match.en)
  }
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <h4 className="text-sm font-semibold text-neutral-800">{title}</h4>
        {error ? (
          <p role="alert" className="text-xs font-medium text-rose-700">
            {error}
          </p>
        ) : (
          hint && <p className="text-xs text-neutral-500">{hint}</p>
        )}
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-4 text-center text-xs text-neutral-400">
          {emptyText}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          <SortableList
            items={items}
            getId={itemId}
            onReorder={onReorder}
            itemLabel={itemLabel ?? itemNoun}
          >
            {(item, index, sortable) => (
              <li
                ref={sortable.setNodeRef}
                style={sortable.style}
                className={`relative flex items-start gap-2 rounded-lg border bg-neutral-50 p-2 ${
                  sortable.isDragging ? 'z-10 border-brand-300 shadow-md' : 'border-neutral-200'
                }`}
              >
                <div className="pt-0.5">
                  <DragHandle
                    ref={sortable.setActivatorNodeRef}
                    {...sortable.attributes}
                    {...sortable.listeners}
                    label={`Перетащить ${itemNoun} ${index + 1}, чтобы изменить порядок`}
                  />
                </div>
                <span className="w-4 shrink-0 pt-2 text-center text-xs tabular-nums text-neutral-400">
                  {index + 1}
                </span>
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                  <SuggestInput
                    value={item.text.ru}
                    onChange={(value) => onChangeText(item.key, 'ru', value)}
                    onPick={(label) => pickSuggestion(item.key, label, 'ru')}
                    suggestions={ruSuggestions}
                    aria-label={`${title} ${index + 1} — Русский`}
                    placeholder="Русский"
                    className="text-sm"
                  />
                  <SuggestInput
                    value={item.text.en}
                    onChange={(value) => onChangeText(item.key, 'en', value)}
                    onPick={(label) => pickSuggestion(item.key, label, 'en')}
                    suggestions={enSuggestions}
                    aria-label={`${title} ${index + 1} — English`}
                    placeholder="English"
                    className="text-sm"
                  />
                </div>
                <div className="pt-0.5">
                  <RemoveButton onClick={() => onRemove(item.key)} label={`Удалить ${itemNoun}`} />
                </div>
              </li>
            )}
          </SortableList>
        </ul>
      )}

      <AddButton onClick={onAdd}>{addLabel}</AddButton>
    </div>
  )
}
