import { useState } from 'react'
import { Button, buttonClassName, Field, Input, Select, Spinner } from '@/shared/ui'
import { ImageUrlField } from '@/features/admin/ui/ImageUrlField'
import { ImageListEditor, type ImageListItem } from '@/features/admin/ui/ImageListEditor'
import { TranslationGroup } from '@/features/admin/ui/TranslationGroup'
import type { Localized } from '@/features/admin/types/localized'
import { readLocalized } from '@/features/admin/catalog/lib/catalogMapper'
import type { PlaceInfoModel, RegionInfoModel } from '@/shared/types/attours'

const newKey = (): string => crypto.randomUUID()

/** No `sortOrder` on purpose: position is set by dragging rows in the list (see
 * `lib/useCatalogReorder.ts`), not by typing a number here. Same for `images` — order is array
 * index, changed by dragging rows in `ImageListEditor`. */
export interface PlaceFormValues {
  slug: string
  regionId: string
  latitude: string
  longitude: string
  imageUrl: string
  images: ImageListItem[]
  name: Localized
}

function initialValues(place: PlaceInfoModel | null): PlaceFormValues {
  if (!place) {
    return {
      slug: '',
      regionId: '',
      latitude: '',
      longitude: '',
      imageUrl: '',
      images: [],
      name: { ru: '', en: '' },
    }
  }
  return {
    slug: place.slug,
    regionId: String(place.regionId),
    latitude: place.latitude == null ? '' : String(place.latitude),
    longitude: place.longitude == null ? '' : String(place.longitude),
    imageUrl: place.imageUrl,
    images: [...place.images]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((img) => ({ key: newKey(), serverId: img.id, url: img.url })),
    name: readLocalized(place.translations),
  }
}

interface FormErrors {
  slug?: string
  regionId?: string
  nameRu?: string
  nameEn?: string
}

function validate(values: PlaceFormValues): FormErrors {
  const errors: FormErrors = {}
  if (values.slug.trim() === '') errors.slug = 'Укажите слаг.'
  if (values.regionId === '') errors.regionId = 'Выберите регион.'
  // Both languages are required, same reasoning as the settings screen (D4-1): the public site
  // resolves a tour's route-point text as `own(lang) ?? template(lang)` — a template with no EN
  // shows up empty for English visitors whenever the tour doesn't override it itself.
  if (values.name.ru.trim() === '') errors.nameRu = 'Обязательное поле.'
  if (values.name.en.trim() === '') errors.nameEn = 'Обязательное поле.'
  return errors
}

interface PlaceFormProps {
  place: PlaceInfoModel | null
  regions: RegionInfoModel[]
  isSubmitting: boolean
  error: string | null
  onSubmit: (values: PlaceFormValues) => void
  onCancel: () => void
}

export function PlaceForm({ place, regions, isSubmitting, error, onSubmit, onCancel }: PlaceFormProps) {
  const [values, setValues] = useState<PlaceFormValues>(() => initialValues(place))
  const [attempted, setAttempted] = useState(false)

  const errors = validate(values)
  const shown = attempted ? errors : {}

  const regionOptions = regions.map((region) => ({
    value: String(region.id),
    label: readLocalized(region.translations).ru || region.slug,
  }))

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

      <Field label="Слаг" htmlFor="place-slug" required error={shown.slug} hint="Уникальный, латиницей, напр. «garni-temple».">
        <Input
          id="place-slug"
          value={values.slug}
          onChange={(e) => setValues((v) => ({ ...v, slug: e.target.value }))}
          error={Boolean(shown.slug)}
        />
      </Field>

      <Field label="Регион" htmlFor="place-region" required error={shown.regionId}>
        <Select
          id="place-region"
          surface="admin"
          value={values.regionId}
          onChange={(value) => setValues((v) => ({ ...v, regionId: value }))}
          options={regionOptions}
          placeholder="Выберите регион"
          error={Boolean(shown.regionId)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Широта" htmlFor="place-lat" hint="Необязательно.">
          <Input
            id="place-lat"
            type="text"
            inputMode="decimal"
            value={values.latitude}
            onChange={(e) => setValues((v) => ({ ...v, latitude: e.target.value }))}
          />
        </Field>
        <Field label="Долгота" htmlFor="place-lng" hint="Необязательно.">
          <Input
            id="place-lng"
            type="text"
            inputMode="decimal"
            value={values.longitude}
            onChange={(e) => setValues((v) => ({ ...v, longitude: e.target.value }))}
          />
        </Field>
      </div>

      <ImageUrlField
        label="Обложка — URL"
        value={values.imageUrl}
        onChange={(value) => setValues((v) => ({ ...v, imageUrl: value }))}
        hint="Необязательно. Используется, пока у точки нет фотографий ниже."
      />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-neutral-700">Фотографии</span>
        <p className="text-xs text-neutral-500">
          Добавляются в галерею дня автоматически, когда эта точка выбрана из справочника в
          маршруте (не для точек, введённых свободным текстом).
        </p>
        <ImageListEditor
          items={values.images}
          onAdd={() => setValues((v) => ({ ...v, images: [...v.images, { key: newKey(), url: '' }] }))}
          onRemove={(key) =>
            setValues((v) => ({ ...v, images: v.images.filter((img) => img.key !== key) }))
          }
          onReorder={(fromIndex, toIndex) =>
            setValues((v) => {
              if (fromIndex === toIndex) return v
              const isInRange = (i: number) => Number.isInteger(i) && i >= 0 && i < v.images.length
              if (!isInRange(fromIndex) || !isInRange(toIndex)) return v
              const next = [...v.images]
              const [moved] = next.splice(fromIndex, 1)
              next.splice(toIndex, 0, moved)
              return { ...v, images: next }
            })
          }
          onChangeUrl={(key, value) =>
            setValues((v) => ({
              ...v,
              images: v.images.map((img) => (img.key === key ? { ...img, url: value } : img)),
            }))
          }
        />
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
          ) : place ? (
            'Сохранить'
          ) : (
            'Добавить'
          )}
        </Button>
      </div>
    </form>
  )
}
