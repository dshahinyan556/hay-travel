import { useState } from 'react'
import { Button, buttonClassName, Field, Select, Spinner } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminCommonCopy } from '@/features/admin/lib/adminCommonCopy'
import { TourNoteType } from '@/features/admin/lib/enums'
import { TranslationGroup } from '@/features/admin/ui/TranslationGroup'
import type { Localized } from '@/features/admin/types/localized'
import { readLocalized } from '@/features/admin/catalog/lib/catalogMapper'
import { catalogCopy, type CatalogCopy } from '@/features/admin/catalog/lib/catalogCopy'
import type { TourNoteTemplateInfoModel } from '@/shared/types/attours'

/** No `sortOrder` on purpose: position is set by dragging rows in the list (see
 * `lib/useCatalogReorder.ts`), not by typing a number here. */
export interface NoteTemplateFormValues {
  type: string
  name: Localized
}

const typeOptions = (copy: CatalogCopy) =>
  [
    TourNoteType.OrganizationalDetail,
    TourNoteType.Restriction,
    TourNoteType.Included,
    TourNoteType.NotIncluded,
  ].map((type) => ({ value: String(type), label: copy.noteTemplates.typeLabels[type] }))

function initialValues(item: TourNoteTemplateInfoModel | null, defaultType: TourNoteType): NoteTemplateFormValues {
  if (!item) {
    return {
      type: String(defaultType),
      name: { ru: '', en: '' },
    }
  }
  return { type: String(item.type), name: readLocalized(item.translations) }
}

interface FormErrors {
  nameRu?: string
  nameEn?: string
}

function validate(values: NoteTemplateFormValues, copy: CatalogCopy): FormErrors {
  const errors: FormErrors = {}
  if (values.name.ru.trim() === '') errors.nameRu = copy.common.requiredField
  if (values.name.en.trim() === '') errors.nameEn = copy.common.requiredField
  return errors
}

interface NoteTemplateFormProps {
  item: TourNoteTemplateInfoModel | null
  /** Pre-selected type for a brand-new note (ignored when editing `item`) — the type the admin
   * had active in the list's tab filter when they clicked "Добавить заметку", so the form opens
   * already scoped to what they were looking at instead of always defaulting to the first type. */
  defaultType: TourNoteType
  isSubmitting: boolean
  error: string | null
  onSubmit: (values: NoteTemplateFormValues) => void
  onCancel: () => void
}

export function NoteTemplateForm({ item, defaultType, isSubmitting, error, onSubmit, onCancel }: NoteTemplateFormProps) {
  const copy = useCopy(catalogCopy)
  const common = useCopy(adminCommonCopy)
  const [values, setValues] = useState<NoteTemplateFormValues>(() => initialValues(item, defaultType))
  const [attempted, setAttempted] = useState(false)

  const errors = validate(values, copy)
  const shown = attempted ? errors : {}

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setAttempted(true)
    if (Object.keys(validate(values, copy)).length > 0) return
    onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <Field label={copy.noteTemplates.typeField} htmlFor="note-type" required>
        <Select
          id="note-type"
          surface="admin"
          value={values.type}
          onChange={(value) => setValues((v) => ({ ...v, type: value }))}
          options={typeOptions(copy)}
        />
      </Field>

      <TranslationGroup
        label={copy.common.nameField}
        value={values.name}
        onChange={(lang, value) => setValues((v) => ({ ...v, name: { ...v.name, [lang]: value } }))}
        required
        error={shown.nameRu}
        errorEn={shown.nameEn}
      />

      <div className="mt-2 flex justify-end gap-2.5 border-t border-neutral-200 pt-4">
        <button type="button" onClick={onCancel} disabled={isSubmitting} className={buttonClassName('ghost', 'md')}>
          {common.cancel}
        </button>
        <Button type="submit" disabled={isSubmitting} className="min-w-28">
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <Spinner size="sm" />
              {copy.common.savingButton}
            </span>
          ) : item ? (
            common.save
          ) : (
            common.add
          )}
        </Button>
      </div>
    </form>
  )
}
