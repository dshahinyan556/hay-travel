import { createPlace, deletePlace, updatePlace } from '@/features/admin/api/adminCatalog'
import type { ImageListItem } from '@/features/admin/ui/ImageListEditor'
import type { PlaceInfoModel } from '@/shared/types/attours'
import type { FieldErrors } from '../lib/catalogDraft'
import { nameForCreate, nameForUpdate, nameValuesOf, validateName, type NameValues } from '../lib/catalogNameFields'
import type { CatalogTableDef } from '../lib/useCatalogTableDraft'

/** Coordinates are TEXT while editing (a half-typed «40.» must survive a re-render). Photos keep
 * the `ImageListEditor` item shape; their order is the array index. */
export interface PlaceValues extends NameValues {
  slug: string
  regionId: string
  latitude: string
  longitude: string
  imageUrl: string
  images: ImageListItem[]
}

/** «40,14» and «40.14» are the same coordinate; empty or unparsable → `null` (what Save sends —
 * the old `PlaceForm` sent `null` for both too). */
export function parseOptionalDecimal(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const n = Number(trimmed.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

const newImageKey = (): string => crypto.randomUUID()

const sharedFields = (values: PlaceValues) => ({
  slug: values.slug.trim(),
  regionId: Number(values.regionId),
  latitude: parseOptionalDecimal(values.latitude),
  longitude: parseOptionalDecimal(values.longitude),
  imageUrl: values.imageUrl.trim(),
})

export const placesTable: CatalogTableDef<PlaceInfoModel, PlaceValues> = {
  toValues: (place) => ({
    ...nameValuesOf(place.translations),
    slug: place.slug,
    regionId: String(place.regionId),
    latitude: place.latitude == null ? '' : String(place.latitude),
    longitude: place.longitude == null ? '' : String(place.longitude),
    imageUrl: place.imageUrl,
    images: [...place.images]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((img) => ({ key: newImageKey(), serverId: img.id, url: img.url })),
  }),
  emptyValues: () => ({
    nameRu: '',
    nameEn: '',
    slug: '',
    regionId: '',
    latitude: '',
    longitude: '',
    imageUrl: '',
    images: [],
  }),
  normalizers: {
    latitude: parseOptionalDecimal,
    longitude: parseOptionalDecimal,
    // Client keys are minted per load — compare what the server stores: id + URL, in order.
    images: (images) => images.map((img) => [img.serverId ?? 0, img.url.trim()]),
  },
  validate: (values, copy) => {
    // Same rules as the old `PlaceForm`: slug, region and both name languages are required.
    const errors: FieldErrors<PlaceValues> = { ...validateName(values, copy) }
    if (values.slug.trim() === '') errors.slug = copy.places.slugError
    if (values.regionId === '') errors.regionId = copy.places.regionError
    return errors
  },
  update: (place, values, sortOrder) =>
    updatePlace({
      id: place.id,
      regionSlug: place.regionSlug,
      sortOrder,
      ...sharedFields(values),
      translations: nameForUpdate(values),
      // `id: serverId ?? 0` — by-id reconcile on the backend: 0 reads as "new row".
      images: values.images.map((img, i) => ({ id: img.serverId ?? 0, url: img.url.trim(), sortOrder: i })),
    }),
  create: (values, sortOrder) =>
    createPlace({
      ...sharedFields(values),
      sortOrder,
      translations: nameForCreate(values),
      images: values.images.map((img, i) => ({ url: img.url.trim(), sortOrder: i })),
    }),
  remove: deletePlace,
  errorActions: (copy) => copy.places.actions,
}
