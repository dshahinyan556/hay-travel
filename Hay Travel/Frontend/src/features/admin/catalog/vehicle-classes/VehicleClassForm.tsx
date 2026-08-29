import { useState } from 'react'
import { Button, buttonClassName, Checkbox, Field, Input, Spinner } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminCommonCopy } from '@/features/admin/lib/adminCommonCopy'
import { TranslationGroup } from '@/features/admin/ui/TranslationGroup'
import type { Localized } from '@/features/admin/types/localized'
import { readLocalized } from '@/features/admin/catalog/lib/catalogMapper'
import { catalogCopy, type CatalogCopy } from '@/features/admin/catalog/lib/catalogCopy'
import type { VehicleClassInfoModel } from '@/shared/types/attours'

/** No `sortOrder` on purpose — same reasoning as every other catalog form (see
 * `lib/useCatalogReorder.ts`): position is set by dragging rows in the list, not by typing a
 * number here. `capacity`/`luggageCapacity` are numeric state directly (not text), matching the
 * `Input type="number"` convention used by `orders/components/AddLineModal.tsx`. */
export interface VehicleClassFormValues {
  name: Localized
  capacity: number
  luggageCapacity: number
  isActive: boolean
}

function initialValues(item: VehicleClassInfoModel | null): VehicleClassFormValues {
  if (!item) {
    return { name: { ru: '', en: '' }, capacity: 1, luggageCapacity: 0, isActive: true }
  }
  return {
    name: readLocalized(item.translations),
    capacity: item.capacity,
    luggageCapacity: item.luggageCapacity,
    isActive: item.isActive,
  }
}

interface FormErrors {
  nameRu?: string
  nameEn?: string
  capacity?: string
  luggageCapacity?: string
}

function validate(values: VehicleClassFormValues, copy: CatalogCopy): FormErrors {
  const errors: FormErrors = {}
  // Both languages required — same reasoning as every other catalog form (D4-1 pattern).
  if (values.name.ru.trim() === '') errors.nameRu = copy.common.requiredField
  if (values.name.en.trim() === '') errors.nameEn = copy.common.requiredField
  if (!Number.isInteger(values.capacity) || values.capacity < 1) {
    errors.capacity = copy.vehicleClasses.capacityError
  }
  if (!Number.isInteger(values.luggageCapacity) || values.luggageCapacity < 0) {
    errors.luggageCapacity = copy.vehicleClasses.luggageCapacityError
  }
  return errors
}

interface VehicleClassFormProps {
  item: VehicleClassInfoModel | null
  isSubmitting: boolean
  error: string | null
  onSubmit: (values: VehicleClassFormValues) => void
  onCancel: () => void
}

export function VehicleClassForm({ item, isSubmitting, error, onSubmit, onCancel }: VehicleClassFormProps) {
  const copy = useCopy(catalogCopy)
  const common = useCopy(adminCommonCopy)
  const [values, setValues] = useState<VehicleClassFormValues>(() => initialValues(item))
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

      <TranslationGroup
        label={copy.common.nameField}
        value={values.name}
        onChange={(lang, value) => setValues((v) => ({ ...v, name: { ...v.name, [lang]: value } }))}
        required
        error={shown.nameRu}
        errorEn={shown.nameEn}
      />

      <div className="grid grid-cols-2 gap-3">
        <Field
          label={copy.vehicleClasses.capacityLabel}
          htmlFor="vehicle-class-capacity"
          required
          error={shown.capacity}
          hint={copy.vehicleClasses.capacityHint}
        >
          <Input
            id="vehicle-class-capacity"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={values.capacity}
            onChange={(e) => setValues((v) => ({ ...v, capacity: Number(e.target.value) }))}
            error={Boolean(shown.capacity)}
          />
        </Field>
        <Field
          label={copy.vehicleClasses.luggageCapacityLabel}
          htmlFor="vehicle-class-luggage"
          required
          error={shown.luggageCapacity}
          hint={copy.vehicleClasses.luggageCapacityHint}
        >
          <Input
            id="vehicle-class-luggage"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={values.luggageCapacity}
            onChange={(e) => setValues((v) => ({ ...v, luggageCapacity: Number(e.target.value) }))}
            error={Boolean(shown.luggageCapacity)}
          />
        </Field>
      </div>

      <Checkbox
        label={copy.vehicleClasses.isActiveLabel}
        checked={values.isActive}
        onChange={(e) => setValues((v) => ({ ...v, isActive: e.target.checked }))}
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
