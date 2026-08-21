import { useState } from 'react'
import { Button, buttonClassName, Spinner } from '@/shared/ui'
import { TAG_COLOR_HEX } from '@/shared/ui/ProductTag'
import { TranslationGroup } from '@/features/admin/ui/TranslationGroup'
import type { Localized } from '@/features/admin/types/localized'
import { readLocalized } from '@/features/admin/catalog/lib/catalogMapper'
import { TagColor, tagColorLabels } from '@/features/admin/lib/enums'
import type { TagInfoModel } from '@/shared/types/attours'

/** No `sortOrder` on purpose — same reasoning as `ExpenseTemplateForm`: position is set by
 * dragging rows in the list. No `type` either — `TagType` is single-member now (Фаза 3/7,
 * discount moved to the tour itself), `TagsTab` always submits `TagType.Regular`. */
export interface TagFormValues {
  name: Localized
  color: TagColor
}

function initialValues(item: TagInfoModel | null): TagFormValues {
  if (!item) {
    return { name: { ru: '', en: '' }, color: TagColor.Gold }
  }
  return {
    name: readLocalized(item.translations),
    color: item.color as TagColor,
  }
}

interface FormErrors {
  nameRu?: string
  nameEn?: string
}

function validate(values: TagFormValues): FormErrors {
  const errors: FormErrors = {}
  if (values.name.ru.trim() === '') errors.nameRu = 'Обязательное поле.'
  if (values.name.en.trim() === '') errors.nameEn = 'Обязательное поле.'
  return errors
}

const COLOR_OPTIONS: TagColor[] = [TagColor.Gold, TagColor.Wine, TagColor.Success, TagColor.Danger, TagColor.Warning]

interface TagFormProps {
  item: TagInfoModel | null
  isSubmitting: boolean
  error: string | null
  onSubmit: (values: TagFormValues) => void
  onCancel: () => void
}

export function TagForm({ item, isSubmitting, error, onSubmit, onCancel }: TagFormProps) {
  const [values, setValues] = useState<TagFormValues>(() => initialValues(item))
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

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-neutral-700">Цвет</span>
        <div role="radiogroup" aria-label="Цвет тега" className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map((option) => {
            const selected = option === values.color
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={tagColorLabels[option]}
                title={tagColorLabels[option]}
                onClick={() => setValues((v) => ({ ...v, color: option }))}
                className={`h-8 w-8 rounded-full ring-2 ring-offset-2 transition-shadow focus:outline-none focus-visible:ring-brand-600/60 ${
                  selected ? 'ring-brand-600' : 'ring-transparent'
                }`}
                style={{ background: TAG_COLOR_HEX[option] }}
              />
            )
          })}
        </div>
      </div>

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
