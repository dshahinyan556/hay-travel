import { useState } from 'react'
import { Button, buttonClassName, Field, Input, Select, Spinner } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminCommonCopy } from '@/features/admin/lib/adminCommonCopy'
import { catalogCopy } from '@/features/admin/catalog/lib/catalogCopy'
import { ImageUrlField } from '@/features/admin/ui/ImageUrlField'
import { ImageListEditor, type ImageListItem } from '@/features/admin/ui/ImageListEditor'
import { TranslationGroup } from '@/features/admin/ui/TranslationGroup'
import type { Localized } from '@/features/admin/types/localized'
import { readLocalized } from '@/features/admin/catalog/lib/catalogMapper'
import type { CatalogCopy } from '@/features/admin/catalog/lib/catalogCopy'
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

/** Pure — the messages come in with `copy` rather than being read from a locale here, so the
 * function stays callable from anywhere and re-runs naturally when the interface locale changes. */
function validate(values: PlaceFormValues, copy: CatalogCopy): FormErrors {
  const errors: FormErrors = {}
  if (values.slug.trim() === '') errors.slug = copy.places.slugError
  if (values.regionId === '') errors.regionId = copy.places.regionError
  // Both languages are required, same reasoning as the settings screen (D4-1): the public site
  // resolves a tour's route-point text as `own(lang) ?? template(lang)` — a template with no EN
  // shows up empty for English visitors whenever the tour doesn't override it itself.
  if (values.name.ru.trim() === '') errors.nameRu = copy.common.requiredField
  if (values.name.en.trim() === '') errors.nameEn = copy.common.requiredField
  return errors
}

interface PlaceFormProps {
  place: PlaceInfoModel | null
  /** `null` — the role may edit points but not read `catalog.regions`. The picker then renders
   * disabled with an explanation instead of as an empty dropdown (frontend roles architecture
   * §0.8: an unexplained empty list hides a permission misconfiguration). */
  regions: RegionInfoModel[] | null
  isSubmitting: boolean
  error: string | null
  onSubmit: (values: PlaceFormValues) => void
  onCancel: () => void
}

export function PlaceForm({ place, regions, isSubmitting, error, onSubmit, onCancel }: PlaceFormProps) {
  const copy = useCopy(catalogCopy)
  const common = useCopy(adminCommonCopy)
  const [values, setValues] = useState<PlaceFormValues>(() => initialValues(place))
  const [attempted, setAttempted] = useState(false)

  const errors = validate(values, copy)
  const shown = attempted ? errors : {}

  const regionsUnavailable = regions === null
  const regionOptions = (regions ?? []).map((region) => ({
    value: String(region.id),
    label: readLocalized(region.translations).ru || region.slug,
  }))

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

      <Field
        label={copy.places.slugLabel}
        htmlFor="place-slug"
        required
        error={shown.slug}
        hint={copy.places.slugHint}
      >
        <Input
          id="place-slug"
          value={values.slug}
          onChange={(e) => setValues((v) => ({ ...v, slug: e.target.value }))}
          error={Boolean(shown.slug)}
        />
      </Field>

      <Field
        label={copy.places.regionLabel}
        htmlFor="place-region"
        required
        error={shown.regionId}
        hint={regionsUnavailable ? copy.places.regionsUnavailableHint : undefined}
      >
        <Select
          id="place-region"
          surface="admin"
          value={values.regionId}
          onChange={(value) => setValues((v) => ({ ...v, regionId: value }))}
          options={regionOptions}
          placeholder={copy.places.regionPlaceholder}
          disabled={regionsUnavailable}
          error={Boolean(shown.regionId)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={copy.places.latitudeLabel} htmlFor="place-lat" hint={copy.places.optionalHint}>
          <Input
            id="place-lat"
            type="text"
            inputMode="decimal"
            value={values.latitude}
            onChange={(e) => setValues((v) => ({ ...v, latitude: e.target.value }))}
          />
        </Field>
        <Field label={copy.places.longitudeLabel} htmlFor="place-lng" hint={copy.places.optionalHint}>
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
        label={copy.places.coverLabel}
        value={values.imageUrl}
        onChange={(value) => setValues((v) => ({ ...v, imageUrl: value }))}
        hint={copy.places.coverHint}
      />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-neutral-700">{copy.places.photosLabel}</span>
        <p className="text-xs text-neutral-500">{copy.places.photosHint}</p>
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
          {common.cancel}
        </button>
        <Button type="submit" disabled={isSubmitting} className="min-w-28">
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <Spinner size="sm" />
              {copy.common.savingButton}
            </span>
          ) : place ? (
            common.save
          ) : (
            common.add
          )}
        </Button>
      </div>
    </form>
  )
}
