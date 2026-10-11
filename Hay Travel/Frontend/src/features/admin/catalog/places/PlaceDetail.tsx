import { useId } from 'react'
import { Field, Input } from '@/shared/ui'
import { HelpButton } from '@/shared/ui/HelpButton'
import { HelpRevealZone } from '@/shared/ui/HelpReveal'
import { useCopy } from '@/shared/i18n/defineCopy'
import { ImageListEditor, type ImageListItem } from '@/features/admin/ui/ImageListEditor'
import { ImageUrlField } from '@/features/admin/ui/ImageUrlField'
import type { PlaceInfoModel } from '@/shared/types/attours'
import { catalogCopy } from '../lib/catalogCopy'
import type { CatalogCellContext } from '../grid/catalogColumns'
import type { PlaceValues } from './placesTable'

type Ctx = CatalogCellContext<PlaceInfoModel, PlaceValues>

/** Ring for a changed detail field — `Input` owns its own background, so the tint is a ring. */
const changedClass = (changed: boolean) => (changed ? 'ring-2 ring-blue-300' : '')

function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-semibold text-neutral-600">{label}</span>
      <span className="truncate text-sm text-neutral-800" title={value || undefined}>
        {value || '—'}
      </span>
    </div>
  )
}

/**
 * «Строка-деталь» of a route point (mockup §2): the long fields that don't fit a cell —
 * coordinates, cover URL and the photo list — with the same editors the old `PlaceForm` used
 * (`ImageUrlField` with upload, `ImageListEditor` with drag + upload). Every change goes into the
 * page draft like any cell edit.
 */
export function PlaceDetail({ ctx }: { ctx: Ctx }) {
  const copy = useCopy(catalogCopy)
  const baseId = useId()
  const { values, changed } = ctx.row
  const setImages = (images: ImageListItem[]) => ctx.setField('images', images)

  if (!ctx.editable) {
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <ReadOnlyValue label={copy.places.latitudeLabel} value={values.latitude} />
          <ReadOnlyValue label={copy.places.longitudeLabel} value={values.longitude} />
          <div className="col-span-2">
            <ReadOnlyValue label={copy.places.coverLabel} value={values.imageUrl} />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-neutral-600">{copy.places.photosLabel}</span>
          {values.images.length === 0 ? (
            <span className="text-sm text-neutral-400">—</span>
          ) : (
            <ul className="flex flex-col gap-0.5 text-sm text-neutral-700">
              {values.images.map((img) => (
                <li key={img.key} className="truncate" title={img.url}>
                  {img.url}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label={copy.places.latitudeLabel} htmlFor={`${baseId}-lat`} hint={copy.places.optionalHint}>
          <Input
            id={`${baseId}-lat`}
            inputMode="decimal"
            value={values.latitude}
            onChange={(e) => ctx.setField('latitude', e.target.value)}
            className={changedClass(changed.has('latitude'))}
          />
        </Field>
        <Field label={copy.places.longitudeLabel} htmlFor={`${baseId}-lng`} hint={copy.places.optionalHint}>
          <Input
            id={`${baseId}-lng`}
            inputMode="decimal"
            value={values.longitude}
            onChange={(e) => ctx.setField('longitude', e.target.value)}
            className={changedClass(changed.has('longitude'))}
          />
        </Field>
      </div>

      <div className={`rounded-lg ${changedClass(changed.has('imageUrl'))}`}>
        <ImageUrlField
          label={copy.places.coverLabel}
          value={values.imageUrl}
          onChange={(value) => ctx.setField('imageUrl', value)}
          hint={copy.places.coverHint}
        />
      </div>

      <HelpRevealZone className={`flex flex-col gap-2 rounded-lg ${changedClass(changed.has('images'))}`}>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-neutral-700">
          {copy.places.photosLabel}
          <HelpButton surface="admin" title={copy.places.photosLabel}>
            {copy.places.photosHint}
          </HelpButton>
        </span>
        <ImageListEditor
          items={values.images}
          onAdd={() => setImages([...values.images, { key: crypto.randomUUID(), url: '' }])}
          onRemove={(key) => setImages(values.images.filter((img) => img.key !== key))}
          onReorder={(fromIndex, toIndex) => {
            if (fromIndex === toIndex) return
            const next = [...values.images]
            const [moved] = next.splice(fromIndex, 1)
            if (moved === undefined) return
            next.splice(toIndex, 0, moved)
            setImages(next)
          }}
          onChangeUrl={(key, url) => setImages(values.images.map((img) => (img.key === key ? { ...img, url } : img)))}
        />
      </HelpRevealZone>
    </div>
  )
}
