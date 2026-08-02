import { useState } from 'react'
import { Button, buttonClassName, Spinner } from '@/shared/ui'
import { TranslationGroup } from '@/features/admin/ui/TranslationGroup'
import type { Localized } from '@/features/admin/types/localized'
import { readLocalized } from '@/features/admin/catalog/lib/catalogMapper'
import type { ExpenseTemplateInfoModel } from '@/shared/types/attours'

/** No `sortOrder` on purpose: position is set by dragging rows in the list (see
 * `lib/useCatalogReorder.ts`), not by typing a number here. */
export interface ExpenseTemplateFormValues {
  name: Localized
}

function initialValues(item: ExpenseTemplateInfoModel | null): ExpenseTemplateFormValues {
  if (!item) return { name: { ru: '', en: '' } }
  return { name: readLocalized(item.translations) }
}

interface FormErrors {
  nameRu?: string
  nameEn?: string
}

function validate(values: ExpenseTemplateFormValues): FormErrors {
  const errors: FormErrors = {}
  // Both languages required — same reasoning as PlaceForm (D4-1 pattern): the public site never
  // falls back from an empty EN template to RU.
  if (values.name.ru.trim() === '') errors.nameRu = 'Обязательное поле.'
  if (values.name.en.trim() === '') errors.nameEn = 'Обязательное поле.'
  return errors
}

interface ExpenseTemplateFormProps {
  item: ExpenseTemplateInfoModel | null
  isSubmitting: boolean
  error: string | null
  onSubmit: (values: ExpenseTemplateFormValues) => void
  onCancel: () => void
}

export function ExpenseTemplateForm({ item, isSubmitting, error, onSubmit, onCancel }: ExpenseTemplateFormProps) {
  const [values, setValues] = useState<ExpenseTemplateFormValues>(() => initialValues(item))
  const [attempted, setAttempted] = useState(false)

  const errors = validate(values)
  const shown = attempted ? errors : {}

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setAttempted(true)
    if (Object.keys(validate(values)).length > 0) return
    onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <TranslationGroup
        label="Название"
        value={values.name}
        onChange={(lang, value) => setValues((v) => ({ ...v, name: { ...v.name, [lang]: value } }))}
        required
        error={shown.nameRu}
        errorEn={shown.nameEn}
      />

      <div className="mt-2 flex justify-end gap-2.5 border-t border-neutral-200 pt-4">
        <button type="button" onClick={onCancel} disabled={isSubmitting} className={buttonClassName('ghost', 'md')}>
          Отмена
        </button>
        <Button type="submit" disabled={isSubmitting} className="min-w-28">
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <Spinner size="sm" />
              Сохранение…
            </span>
          ) : item ? (
            'Сохранить'
          ) : (
            'Добавить'
          )}
        </Button>
      </div>
    </form>
  )
}
