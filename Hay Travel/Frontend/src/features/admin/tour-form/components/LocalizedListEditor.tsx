import { Input } from '@/shared/ui'
import type { LocalizedListItem } from '@/features/admin/types/form'
import type { LangKey, MoveDirection } from '@/features/admin/tour-form/reducer/tourFormReducer'
import { AddButton, RemoveButton, ReorderButtons } from './RepeaterControls'

interface LocalizedListEditorProps {
  /** Section heading, e.g. "Точки маршрута". */
  title: string
  /** Helper text under the heading. */
  hint?: string
  /** Message shown in place of rows when the list is empty. */
  emptyText: string
  /** Text for the add button, e.g. "Добавить точку". */
  addLabel: string
  /** Singular noun for a11y labels, e.g. "точку". */
  itemNoun: string
  /** Blocking error for the whole list (e.g. "add at least one route point"). */
  error?: string
  items: LocalizedListItem[]
  onAdd: () => void
  onRemove: (key: string) => void
  onMove: (key: string, direction: MoveDirection) => void
  onChangeText: (key: string, lang: LangKey, value: string) => void
}

/**
 * Shared repeater for any ordered list of a single bilingual text — route points,
 * organizational details and restrictions all use it. One implementation, three call sites:
 * a compact RU | EN row per item with reorder/remove controls, plus an add button. Order is
 * meaningful (mapped to the backend `sortOrder`), hence the ▲▼ controls.
 */
export function LocalizedListEditor({
  title,
  hint,
  emptyText,
  addLabel,
  itemNoun,
  error,
  items,
  onAdd,
  onRemove,
  onMove,
  onChangeText,
}: LocalizedListEditorProps) {
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
          {items.map((item, index) => (
            <li
              key={item.key}
              className="flex items-start gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2"
            >
              <div className="pt-1.5">
                <ReorderButtons
                  onMove={(direction) => onMove(item.key, direction)}
                  canMoveUp={index > 0}
                  canMoveDown={index < items.length - 1}
                  itemNoun={itemNoun}
                />
              </div>
              <span className="w-4 shrink-0 pt-2 text-center text-xs tabular-nums text-neutral-400">
                {index + 1}
              </span>
              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                <Input
                  value={item.text.ru}
                  onChange={(e) => onChangeText(item.key, 'ru', e.target.value)}
                  aria-label={`${title} ${index + 1} — Русский`}
                  placeholder="Русский"
                  className="text-sm"
                />
                <Input
                  value={item.text.en}
                  onChange={(e) => onChangeText(item.key, 'en', e.target.value)}
                  aria-label={`${title} ${index + 1} — English`}
                  placeholder="English"
                  className="text-sm"
                />
              </div>
              <div className="pt-0.5">
                <RemoveButton onClick={() => onRemove(item.key)} label={`Удалить ${itemNoun}`} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddButton onClick={onAdd}>{addLabel}</AddButton>
    </div>
  )
}
