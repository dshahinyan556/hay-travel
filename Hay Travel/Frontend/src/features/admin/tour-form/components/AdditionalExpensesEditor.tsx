import { Input, SuggestInput } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import type { ExpenseFormState, Localized } from '@/features/admin/types/form'
import type { LangKey } from '@/features/admin/tour-form/reducer/tourFormReducer'
import { AddButton, RemoveButton } from '@/features/admin/ui/RepeaterControls'
import { adminUiCopy } from '@/features/admin/ui/adminUiCopy'
import { tourFormCopy } from '@/features/admin/tour-form/lib/tourFormCopy'

interface AdditionalExpensesEditorProps {
  items: ExpenseFormState[]
  /** Existing expense-template catalog entries offered as autocomplete for the description —
   * picking one fills both languages at once, the text stays freely editable afterwards. */
  suggestions?: Localized[]
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
  suggestions,
  onAdd,
  onRemove,
  onChangeAmount,
  onChangeDescription,
}: AdditionalExpensesEditorProps) {
  const copy = useCopy(tourFormCopy).expenses
  // RU|EN here are the CONTENT languages of the description, not the interface locale — only
  // their captions follow the interface language.
  const translation = useCopy(adminUiCopy).translation
  const ruSuggestions = suggestions?.map((s) => s.ru).filter(Boolean) ?? []
  const enSuggestions = suggestions?.map((s) => s.en).filter(Boolean) ?? []
  const pickSuggestion = (key: string, label: string, lang: LangKey) => {
    const match = suggestions?.find((s) => s[lang] === label)
    if (!match) return
    onChangeDescription(key, 'ru', match.ru)
    onChangeDescription(key, 'en', match.en)
  }

  return (
    <div className="flex flex-col gap-2.5">
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-4 text-center text-xs text-neutral-400">
          {copy.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {items.map((item, index) => (
            <li
              key={item.key}
              className="grid items-start gap-2.5 rounded-lg border border-neutral-200 bg-neutral-50 p-2.5 sm:grid-cols-[1fr_1fr_130px_auto]"
            >
              <SuggestInput
                value={item.description.ru}
                onChange={(value) => onChangeDescription(item.key, 'ru', value)}
                onPick={(label) => pickSuggestion(item.key, label, 'ru')}
                suggestions={ruSuggestions}
                aria-label={translation.fieldInLang(copy.descriptionLabel(index + 1), translation.langName.ru)}
                placeholder={copy.descriptionRu}
                className="text-sm"
              />
              <SuggestInput
                value={item.description.en}
                onChange={(value) => onChangeDescription(item.key, 'en', value)}
                onPick={(label) => pickSuggestion(item.key, label, 'en')}
                suggestions={enSuggestions}
                aria-label={translation.fieldInLang(copy.descriptionLabel(index + 1), translation.langName.en)}
                placeholder={copy.descriptionEn}
                className="text-sm"
              />
              <Input
                type="text"
                inputMode="decimal"
                value={item.amount}
                onChange={(e) => onChangeAmount(item.key, e.target.value)}
                aria-label={copy.amountLabel(index + 1)}
                placeholder={copy.amountPlaceholder}
                className="text-sm"
              />
              <div className="justify-self-end sm:pt-0.5">
                <RemoveButton onClick={() => onRemove(item.key)} label={copy.remove} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <AddButton onClick={onAdd}>{copy.add}</AddButton>
    </div>
  )
}
