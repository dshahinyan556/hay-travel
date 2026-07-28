import { Input } from '@/shared/ui'
import type { ExpenseFormState } from '@/features/admin/types/form'
import type { LangKey } from '@/features/admin/tour-form/reducer/tourFormReducer'
import { AddButton, RemoveButton } from './RepeaterControls'

interface AdditionalExpensesEditorProps {
  items: ExpenseFormState[]
  onAdd: () => void
  onRemove: (key: string) => void
  onChangeAmount: (key: string, value: string) => void
  onChangeDescription: (key: string, lang: LangKey, value: string) => void
}

/**
 * Repeater for the tour's optional additional expenses. Each row is an amount plus a bilingual
 * description (RU | EN). Expenses are unordered on the wire, so there are no reorder controls.
 */
export function AdditionalExpensesEditor({
  items,
  onAdd,
  onRemove,
  onChangeAmount,
  onChangeDescription,
}: AdditionalExpensesEditorProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-4 text-center text-xs text-neutral-400">
          Расходов пока нет. Добавьте, если у позиции есть доплаты (билеты, обеды и т. п.).
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {items.map((item, index) => (
            <li
              key={item.key}
              className="grid items-start gap-2.5 rounded-lg border border-neutral-200 bg-neutral-50 p-2.5 sm:grid-cols-[130px_1fr_1fr_auto]"
            >
              <Input
                type="text"
                inputMode="decimal"
                value={item.amount}
                onChange={(e) => onChangeAmount(item.key, e.target.value)}
                aria-label={`Сумма расхода ${index + 1}, ֏`}
                placeholder="Сумма, ֏"
                className="text-sm"
              />
              <Input
                value={item.description.ru}
                onChange={(e) => onChangeDescription(item.key, 'ru', e.target.value)}
                aria-label={`Описание расхода ${index + 1} — Русский`}
                placeholder="Описание (RU)"
                className="text-sm"
              />
              <Input
                value={item.description.en}
                onChange={(e) => onChangeDescription(item.key, 'en', e.target.value)}
                aria-label={`Описание расхода ${index + 1} — English`}
                placeholder="Описание (EN)"
                className="text-sm"
              />
              <div className="justify-self-end sm:pt-0.5">
                <RemoveButton onClick={() => onRemove(item.key)} label="Удалить расход" />
              </div>
            </li>
          ))}
        </ul>
      )}
      <AddButton onClick={onAdd}>Добавить расход</AddButton>
    </div>
  )
}
