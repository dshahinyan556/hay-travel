import { useState } from 'react'
import { Button, buttonClassName, Field, Input, Spinner } from '@/shared/ui'
import { TAG_COLOR_HEX } from '@/shared/ui/ProductTag'
import { TranslationGroup } from '@/features/admin/ui/TranslationGroup'
import type { Localized } from '@/features/admin/types/localized'
import { readLocalized } from '@/features/admin/catalog/lib/catalogMapper'
import { TagColor, TagType, tagColorLabels } from '@/features/admin/lib/enums'
import type { TagInfoModel } from '@/shared/types/attours'

/** No `sortOrder` on purpose — same reasoning as `ExpenseTemplateForm`: position is set by
 * dragging rows in the list. */
export interface TagFormValues {
  name: Localized
  type: TagType
  color: TagColor
  /** Kept as a string while in the input; parsed to a number on submit. Only meaningful (and
   * only validated) when `type === Discount`. */
  discountPercent: string
}

function initialValues(item: TagInfoModel | null): TagFormValues {
  if (!item) {
    return { name: { ru: '', en: '' }, type: TagType.Regular, color: TagColor.Gold, discountPercent: '' }
  }
  return {
    name: readLocalized(item.translations),
    type: item.type as TagType,
    color: item.color as TagColor,
    discountPercent: item.discountPercent == null ? '' : String(item.discountPercent),
  }
}

interface FormErrors {
  nameRu?: string
  nameEn?: string
  discountPercent?: string
}

function validate(values: TagFormValues): FormErrors {
  const errors: FormErrors = {}
  if (values.name.ru.trim() === '') errors.nameRu = 'Обязательное поле.'
  if (values.name.en.trim() === '') errors.nameEn = 'Обязательное поле.'
  if (values.type === TagType.Discount) {
    const n = Number(values.discountPercent.replace(',', '.'))
    if (values.discountPercent.trim() === '' || !Number.isFinite(n) || n <= 0 || n > 100) {
      errors.discountPercent = 'Введите процент от 0 до 100.'
    }
  }
  return errors
}

const TYPE_OPTIONS: TagType[] = [TagType.Regular, TagType.Discount]
const COLOR_OPTIONS: TagColor[] = [TagColor.Gold, TagColor.Wine, TagColor.Success, TagColor.Danger, TagColor.Warning]

interface TagFormProps {
  item: TagInfoModel | null
  isSubmitting: boolean
  error: string | null
  onSubmit: (values: TagFormValues) => void
  onCancel: () => void
}

/** The backend locks `type` once a tag is assigned to a tour (`TagUpdateService`) — `GetAll`
 * doesn't expose an assignment count, so this form can't grey the toggle out proactively. A
 * blocked save surfaces the backend's message instead (`catalogErrorMessage`), same as any other
 * `InvalidEntityRelation` rejection on this screen. */
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
        <span className="text-sm font-semibold text-neutral-700">Тип</span>
        <div role="radiogroup" aria-label="Тип тега" className="inline-flex w-fit rounded-xl border border-neutral-200 bg-neutral-100 p-1">
          {TYPE_OPTIONS.map((option) => {
            const selected = option === values.type
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setValues((v) => ({ ...v, type: option }))}
                className={`cursor-pointer rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 ${
                  selected ? 'bg-white text-brand-800 shadow-sm' : 'text-neutral-600 hover:text-neutral-800'
                }`}
              >
                {option === TagType.Discount ? 'Скидка' : 'Обычный'}
              </button>
            )
          })}
        </div>
        {item && (
          <p className="text-xs text-neutral-400">
            Если тег уже назначен туру, сервер не даст поменять тип — сначала снимите его с тура.
          </p>
        )}
        {values.type === TagType.Discount && (
          <p className="text-xs text-neutral-500">Меняет отображаемую цену и сумму бронирования.</p>
        )}
      </div>

      {values.type === TagType.Discount && (
        <div className="flex flex-col gap-1">
          <div className="w-32">
            <Field label="Скидка, %" htmlFor="tag-discount-percent" error={shown.discountPercent}>
              <Input
                id="tag-discount-percent"
                type="text"
                inputMode="decimal"
                value={values.discountPercent}
                onChange={(e) => setValues((v) => ({ ...v, discountPercent: e.target.value }))}
                placeholder="15"
                error={Boolean(shown.discountPercent)}
              />
            </Field>
          </div>
          <p className="text-xs text-neutral-400">
            Только для расчёта цены — в текст тега не подставляется. Если процент должен быть
            виден на самой карточке, впишите его в название выше (например «Скидка 15%»).
          </p>
        </div>
      )}

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
