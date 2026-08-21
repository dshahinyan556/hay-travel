/**
 * The single place that converts between the backend wire format and the form view-model.
 *
 * Backend translations are a flat list of `{ type, languageCode, value }` rows — two rows
 * (RU + EN) per translatable field. The form binds to `Localized { ru, en }` instead. All
 * flattening/unflattening lives here so no component ever touches the flat list. Route points
 * are their own entity with a single text field encoded as translation `type` 0.
 */

import {
  ExpenseTranslationType,
  LanguageCode,
  TourDayTranslationType,
  TourNoteType,
  TourTranslationType,
  TourType,
} from '@/features/admin/lib/enums'
import type {
  ExpenseTemplateInfoModel,
  PlaceInfoModel,
  TourCreateModel,
  TourDayCreateModel,
  TourInfoModel,
  TourDayInfoModel,
  TourNoteTemplateInfoModel,
  TranslatableCreateModel,
  TranslatableInfoModel,
} from '@/shared/types/attours'
import type {
  ExpenseFormState,
  GalleryItemFormState,
  Localized,
  LocalizedListItem,
  PlaceOption,
  RoutePointFormState,
  TourDayFormState,
  TourFormState,
} from '@/features/admin/types/form'

/* -------------------------------------------------------------------------- */
/*  Empty factories                                                            */
/* -------------------------------------------------------------------------- */

const newKey = (): string => crypto.randomUUID()

export const emptyLocalized = (): Localized => ({ ru: '', en: '' })

/** Route points and every tour note list (organizational details, restrictions, included,
 * not-included) share the LocalizedListItem shape, so one factory serves all of them (exported
 * under intention-revealing aliases). */
export const emptyLocalizedItem = (): LocalizedListItem => ({
  key: newKey(),
  text: emptyLocalized(),
})

export const emptyRoutePoint = (): RoutePointFormState => ({
  key: newKey(),
  text: emptyLocalized(),
  placeId: null,
})

export const emptyOrganizationalDetail = emptyLocalizedItem
export const emptyRestriction = emptyLocalizedItem
export const emptyIncluded = emptyLocalizedItem
export const emptyNotIncluded = emptyLocalizedItem

export const emptyGalleryItem = (): GalleryItemFormState => ({
  key: newKey(),
  url: '',
})

export const emptyExpense = (): ExpenseFormState => ({
  key: newKey(),
  amount: '',
  description: emptyLocalized(),
})

export const emptyDay = (): TourDayFormState => ({
  key: newKey(),
  price: '',
  title: emptyLocalized(),
  shortDescription: emptyLocalized(),
  description: emptyLocalized(),
  duration: emptyLocalized(),
  routePoints: [],
  gallery: [],
  autofilledImageKeys: {},
})

/* -------------------------------------------------------------------------- */
/*  Flat translations <-> Localized                                            */
/* -------------------------------------------------------------------------- */

type AnyTranslation = { type: number; languageCode: number; value: string | null }

/** Pull the RU and EN rows of a given `type` out of a flat translation list. */
export function readLocalized(translations: AnyTranslation[], type: number): Localized {
  const find = (lang: number) =>
    translations.find((t) => t.type === type && t.languageCode === lang)?.value ?? ''
  return { ru: find(LanguageCode.Russian), en: find(LanguageCode.English) }
}

/** Expand a Localized field into its two wire rows (RU + EN) for a given `type`. */
export function writeLocalized(type: number, value: Localized): TranslatableCreateModel[] {
  return [
    { type, languageCode: LanguageCode.Russian, value: value.ru },
    { type, languageCode: LanguageCode.English, value: value.en },
  ]
}

/* -------------------------------------------------------------------------- */
/*  Catalog suggestions (autocomplete)                                        */
/* -------------------------------------------------------------------------- */

/** Catalog entries always encode their bilingual name as translation `type: 0` (see
 * `catalog/lib/catalogMapper.ts`'s header) — a different sentinel-reuse than route points'
 * `type: 0`, coincidentally the same number for an unrelated reason. */
const CATALOG_NAME_TYPE = 0

export function placesToSuggestions(places: PlaceInfoModel[]): Localized[] {
  return places.map((p) => readLocalized(p.translations, CATALOG_NAME_TYPE))
}

/** Place catalog entries offered as a hard link for a route point (F13 gap closure) — distinct
 * from `placesToSuggestions`, which only offers the bilingual name for free-text autocomplete. */
export function placesToOptions(places: PlaceInfoModel[]): PlaceOption[] {
  return places.map((p) => ({
    id: p.id,
    name: readLocalized(p.translations, CATALOG_NAME_TYPE),
    images: placeImageUrls(p),
  }))
}

/** Same `images`-then-`imageUrl` fallback as the backend's `RoutePointGalleryImageCopier`, so the
 * live gallery autofill offers exactly what a save would otherwise have copied in. */
function placeImageUrls(place: PlaceInfoModel): string[] {
  if (place.images.length > 0) return sortBySortOrder(place.images).map((img) => img.url)
  const fallback = place.imageUrl.trim()
  return fallback ? [fallback] : []
}

export function expenseTemplatesToSuggestions(templates: ExpenseTemplateInfoModel[]): Localized[] {
  return templates.map((t) => readLocalized(t.translations, CATALOG_NAME_TYPE))
}

/** `type` is a `TourNoteType` — callers pass one of its four values to get suggestions for the
 * matching tab only. */
export function noteTemplatesToSuggestions(
  templates: TourNoteTemplateInfoModel[],
  type: number,
): Localized[] {
  return templates
    .filter((t) => t.type === type)
    .map((t) => readLocalized(t.translations, CATALOG_NAME_TYPE))
}

/* -------------------------------------------------------------------------- */
/*  DTO -> form                                                                */
/* -------------------------------------------------------------------------- */

/** Stable-sort a list of ordered records by their backend `sortOrder`. */
function sortBySortOrder<T extends { sortOrder: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder)
}

/** Build the create form from the `InitTour` skeleton (translations pre-seeded as null). */
export function createModelToForm(dto: TourCreateModel): TourFormState {
  return {
    type: (dto.type as TourType) ?? TourType.Tour,
    mainImageUrl: dto.mainImageUrl ?? '',
    isActive: dto.isActive,
    requiresPrepayment: dto.requiresPrepayment,
    discountPercent: dto.discountPercent == null ? '' : String(dto.discountPercent),
    discountStartDate: dto.discountStartDate ?? '',
    discountValidUntil: dto.discountValidUntil ?? '',
    title: readLocalized(dto.translations, TourTranslationType.Title),
    shortDescription: readLocalized(dto.translations, TourTranslationType.ShortDescription),
    description: readLocalized(dto.translations, TourTranslationType.Description),
    duration: readLocalized(dto.translations, TourTranslationType.Duration),
    organizationalDetails: (dto.notes ?? [])
      .filter((n) => n.type === TourNoteType.OrganizationalDetail)
      .map((n) => ({
        key: newKey(),
        text: readLocalized(n.translations ?? [], ExpenseTranslationType.Description),
      })),
    restrictions: (dto.notes ?? [])
      .filter((n) => n.type === TourNoteType.Restriction)
      .map((n) => ({
        key: newKey(),
        text: readLocalized(n.translations ?? [], ExpenseTranslationType.Description),
      })),
    included: (dto.notes ?? [])
      .filter((n) => n.type === TourNoteType.Included)
      .map((n) => ({
        key: newKey(),
        text: readLocalized(n.translations ?? [], ExpenseTranslationType.Description),
      })),
    notIncluded: (dto.notes ?? [])
      .filter((n) => n.type === TourNoteType.NotIncluded)
      .map((n) => ({
        key: newKey(),
        text: readLocalized(n.translations ?? [], ExpenseTranslationType.Description),
      })),
    days: (dto.tourDays ?? []).map(createDayToForm),
    additionalExpenses: (dto.additionalExpenses ?? []).map((e) => ({
      key: newKey(),
      amount: e.amount == null ? '' : String(e.amount),
      description: readLocalized(e.translations ?? [], ExpenseTranslationType.Description),
    })),
    regions: sortBySortOrder(dto.regions ?? []).map((r) => ({ regionId: r.regionId })),
    tags: (dto.tags ?? []).map((tg) => ({ tagId: tg.tagId })),
  }
}

/** Build the edit form from `InitUpdate`, carrying server ids for the update diff later. */
export function infoToForm(dto: TourInfoModel): TourFormState {
  return {
    type: dto.type as TourType,
    mainImageUrl: dto.mainImageUrl ?? '',
    isActive: dto.isActive,
    requiresPrepayment: dto.requiresPrepayment,
    discountPercent: dto.discountPercent == null ? '' : String(dto.discountPercent),
    discountStartDate: dto.discountStartDate ?? '',
    discountValidUntil: dto.discountValidUntil ?? '',
    title: readLocalized(dto.translations, TourTranslationType.Title),
    shortDescription: readLocalized(dto.translations, TourTranslationType.ShortDescription),
    description: readLocalized(dto.translations, TourTranslationType.Description),
    duration: readLocalized(dto.translations, TourTranslationType.Duration),
    organizationalDetails: sortBySortOrder(
      (dto.notes ?? []).filter((n) => n.type === TourNoteType.OrganizationalDetail),
    ).map((n) => ({
      key: newKey(),
      serverId: n.id,
      text: readLocalized(n.translations ?? [], ExpenseTranslationType.Description),
    })),
    restrictions: sortBySortOrder(
      (dto.notes ?? []).filter((n) => n.type === TourNoteType.Restriction),
    ).map((n) => ({
      key: newKey(),
      serverId: n.id,
      text: readLocalized(n.translations ?? [], ExpenseTranslationType.Description),
    })),
    included: sortBySortOrder(
      (dto.notes ?? []).filter((n) => n.type === TourNoteType.Included),
    ).map((n) => ({
      key: newKey(),
      serverId: n.id,
      text: readLocalized(n.translations ?? [], ExpenseTranslationType.Description),
    })),
    notIncluded: sortBySortOrder(
      (dto.notes ?? []).filter((n) => n.type === TourNoteType.NotIncluded),
    ).map((n) => ({
      key: newKey(),
      serverId: n.id,
      text: readLocalized(n.translations ?? [], ExpenseTranslationType.Description),
    })),
    days: (dto.tourDays ?? []).map(infoDayToForm),
    additionalExpenses: (dto.additionalExpenses ?? []).map((e) => ({
      key: newKey(),
      serverId: e.id,
      amount: e.amount == null ? '' : String(e.amount),
      description: readLocalized(e.translations ?? [], ExpenseTranslationType.Description),
    })),
    regions: sortBySortOrder(dto.regions ?? []).map((r) => ({ serverId: r.id, regionId: r.regionId })),
    tags: (dto.tags ?? []).map((tg) => ({ serverId: tg.id, tagId: tg.tagId })),
  }
}

function createDayToForm(day: TourDayCreateModel): TourDayFormState {
  return {
    key: newKey(),
    price: day.price ? String(day.price) : '',
    title: readLocalized(day.translations ?? [], TourDayTranslationType.Title),
    shortDescription: readLocalized(day.translations ?? [], TourDayTranslationType.ShortDescription),
    description: readLocalized(day.translations ?? [], TourDayTranslationType.Description),
    duration: readLocalized(day.translations ?? [], TourDayTranslationType.Duration),
    routePoints: (day.routePoints ?? []).map((rp) => ({
      key: newKey(),
      text: readLocalized(rp.translations ?? [], ExpenseTranslationType.Description),
      placeId: rp.placeId ?? null,
    })),
    gallery: (day.galleryImages ?? []).map((g) => ({ key: newKey(), url: g.url })),
    autofilledImageKeys: {},
  }
}

function infoDayToForm(day: TourDayInfoModel): TourDayFormState {
  const byOrder = sortBySortOrder
  return {
    key: newKey(),
    serverId: day.id,
    price: day.price ? String(day.price) : '',
    title: readLocalized(day.translations ?? [], TourDayTranslationType.Title),
    shortDescription: readLocalized(day.translations ?? [], TourDayTranslationType.ShortDescription),
    description: readLocalized(day.translations ?? [], TourDayTranslationType.Description),
    duration: readLocalized(day.translations ?? [], TourDayTranslationType.Duration),
    routePoints: byOrder(day.routePoints ?? []).map((rp) => ({
      key: newKey(),
      serverId: rp.id,
      text: readLocalized(rp.translations ?? [], ExpenseTranslationType.Description),
      placeId: rp.placeId ?? null,
    })),
    gallery: byOrder(day.galleryImages ?? []).map((g) => ({
      key: newKey(),
      serverId: g.id,
      url: g.url,
    })),
    autofilledImageKeys: {},
  }
}

/* -------------------------------------------------------------------------- */
/*  form -> DTO                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * For an excursion the single day IS the tour, so its title/description/duration must equal the
 * tour-level ones — the admin never fills them twice (see the excursion form). We treat the
 * tour-level texts as the single source of truth and derive the day's from them at submit time.
 * For a multi-day tour each day keeps its own texts.
 */
function dayTexts(form: TourFormState, day: TourDayFormState): Pick<TourDayFormState, 'title' | 'shortDescription' | 'description' | 'duration'> {
  if (form.type === TourType.Excursion) {
    return {
      title: form.title,
      shortDescription: form.shortDescription,
      description: form.description,
      duration: form.duration,
    }
  }
  return day
}

/** Assemble the create payload. Emits no ids; derives sortOrder from array index. */
export function formToCreateModel(form: TourFormState): TourCreateModel {
  return {
    type: form.type,
    mainImageUrl: form.mainImageUrl.trim() === '' ? null : form.mainImageUrl.trim(),
    isActive: form.isActive,
    requiresPrepayment: form.requiresPrepayment,
    discountPercent: form.discountPercent.trim() === '' ? null : parseDecimal(form.discountPercent),
    discountStartDate: form.discountStartDate.trim() === '' ? null : form.discountStartDate,
    discountValidUntil: form.discountValidUntil.trim() === '' ? null : form.discountValidUntil,
    translations: [
      ...writeLocalized(TourTranslationType.Title, form.title),
      ...writeLocalized(TourTranslationType.ShortDescription, form.shortDescription),
      ...writeLocalized(TourTranslationType.Description, form.description),
      ...writeLocalized(TourTranslationType.Duration, form.duration),
    ],
    tourDays: form.days.map((day) => {
      const texts = dayTexts(form, day)
      return {
        price: parseDecimal(day.price),
        translations: [
          ...writeLocalized(TourDayTranslationType.Title, texts.title),
          ...writeLocalized(TourDayTranslationType.ShortDescription, texts.shortDescription),
          ...writeLocalized(TourDayTranslationType.Description, texts.description),
          ...writeLocalized(TourDayTranslationType.Duration, texts.duration),
        ],
        galleryImages: day.gallery.map((g, i) => ({ url: g.url, sortOrder: i })),
        routePoints: day.routePoints.map((rp, i) => ({
          sortOrder: i,
          placeId: rp.placeId,
          translations: writeLocalized(ExpenseTranslationType.Description, rp.text),
        })),
      }
    }) satisfies TourDayCreateModel[],
    additionalExpenses: form.additionalExpenses.map((e) => ({
      amount: e.amount.trim() === '' ? null : parseDecimal(e.amount),
      translations: writeLocalized(ExpenseTranslationType.Description, e.description),
    })),
    notes: [
      ...form.organizationalDetails.map((o, i) => ({
        type: TourNoteType.OrganizationalDetail,
        sortOrder: i,
        translations: writeLocalized(ExpenseTranslationType.Description, o.text),
      })),
      ...form.restrictions.map((o, i) => ({
        type: TourNoteType.Restriction,
        sortOrder: i,
        translations: writeLocalized(ExpenseTranslationType.Description, o.text),
      })),
      ...form.included.map((o, i) => ({
        type: TourNoteType.Included,
        sortOrder: i,
        translations: writeLocalized(ExpenseTranslationType.Description, o.text),
      })),
      ...form.notIncluded.map((o, i) => ({
        type: TourNoteType.NotIncluded,
        sortOrder: i,
        translations: writeLocalized(ExpenseTranslationType.Description, o.text),
      })),
    ],
    regions: form.regions.map((r, i) => ({ regionId: r.regionId, sortOrder: i })),
    tags: form.tags.map((tg) => ({ tagId: tg.tagId })),
  }
}

/** New-record id sentinel the backend treats as "add" during its reconcile-by-id diff. */
const NEW = 0

/** Tag id-less create rows with `id: 0` so they fit the `TranslatableInfoModel` shape the
 * update endpoint expects. See `formToUpdateModel` for why translation rows are always new. */
function asInfoTranslations(rows: TranslatableCreateModel[]): TranslatableInfoModel[] {
  return rows.map((r) => ({ id: NEW, ...r }))
}

/**
 * Assemble the update payload for an existing tour. The backend reconciles the incoming graph
 * against the stored one **by id**: an entity with a real id is matched and updated, one with
 * `id: 0` is added, and any stored entity absent from the payload is removed. So we carry each
 * entity's `serverId` (falling back to `0` for rows the admin just added).
 *
 * Translation rows are the exception: the form view-model collapses each localized field into
 * a single `{ ru, en }` pair and never tracks the individual row ids, so every translation is
 * emitted as `id: 0`. The server then replaces that field's rows in place — harmless because
 * there is no unique constraint on `(type, languageCode)` and translation ids are never
 * surfaced to the user. `isActive`/`totalPrice` are ignored by the endpoint (publication is
 * managed via `setTourActive`, and the total is recomputed server-side), so their values here
 * are irrelevant.
 */
export function formToUpdateModel(form: TourFormState, tourId: number): TourInfoModel {
  return {
    id: tourId,
    type: form.type,
    isActive: form.isActive,
    // Ignored by UpdateTour (archive/restore go through SetArchived, featured through
    // SetFeatured/ReorderFeatured); present only to satisfy the wire type.
    isArchived: false,
    isFeatured: false,
    featuredSortOrder: 0,
    // NOT ignored by UpdateTour, unlike the three flags above (B12, 2026-08-13).
    requiresPrepayment: form.requiresPrepayment,
    discountPercent: form.discountPercent.trim() === '' ? null : parseDecimal(form.discountPercent),
    discountStartDate: form.discountStartDate.trim() === '' ? null : form.discountStartDate,
    discountValidUntil: form.discountValidUntil.trim() === '' ? null : form.discountValidUntil,
    mainImageUrl: form.mainImageUrl.trim() === '' ? null : form.mainImageUrl.trim(),
    translations: asInfoTranslations([
      ...writeLocalized(TourTranslationType.Title, form.title),
      ...writeLocalized(TourTranslationType.ShortDescription, form.shortDescription),
      ...writeLocalized(TourTranslationType.Description, form.description),
      ...writeLocalized(TourTranslationType.Duration, form.duration),
    ]),
    tourDays: form.days.map((day) => {
      const texts = dayTexts(form, day)
      return {
      id: day.serverId ?? NEW,
      price: parseDecimal(day.price),
      translations: asInfoTranslations([
        ...writeLocalized(TourDayTranslationType.Title, texts.title),
        ...writeLocalized(TourDayTranslationType.ShortDescription, texts.shortDescription),
        ...writeLocalized(TourDayTranslationType.Description, texts.description),
        ...writeLocalized(TourDayTranslationType.Duration, texts.duration),
      ]),
      galleryImages: day.gallery.map((g, i) => ({ id: g.serverId ?? NEW, url: g.url, sortOrder: i })),
      routePoints: day.routePoints.map((rp, i) => ({
        id: rp.serverId ?? NEW,
        sortOrder: i,
        placeId: rp.placeId,
        translations: asInfoTranslations(writeLocalized(ExpenseTranslationType.Description, rp.text)),
      })),
      }
    }),
    additionalExpenses: form.additionalExpenses.map((e) => ({
      id: e.serverId ?? NEW,
      amount: e.amount.trim() === '' ? null : parseDecimal(e.amount),
      translations: asInfoTranslations(writeLocalized(ExpenseTranslationType.Description, e.description)),
    })),
    notes: [
      ...form.organizationalDetails.map((o, i) => ({
        id: o.serverId ?? NEW,
        type: TourNoteType.OrganizationalDetail,
        sortOrder: i,
        translations: asInfoTranslations(writeLocalized(ExpenseTranslationType.Description, o.text)),
      })),
      ...form.restrictions.map((o, i) => ({
        id: o.serverId ?? NEW,
        type: TourNoteType.Restriction,
        sortOrder: i,
        translations: asInfoTranslations(writeLocalized(ExpenseTranslationType.Description, o.text)),
      })),
      ...form.included.map((o, i) => ({
        id: o.serverId ?? NEW,
        type: TourNoteType.Included,
        sortOrder: i,
        translations: asInfoTranslations(writeLocalized(ExpenseTranslationType.Description, o.text)),
      })),
      ...form.notIncluded.map((o, i) => ({
        id: o.serverId ?? NEW,
        type: TourNoteType.NotIncluded,
        sortOrder: i,
        translations: asInfoTranslations(writeLocalized(ExpenseTranslationType.Description, o.text)),
      })),
    ],
    // Always the real list (never omitted): the contract's `Regions == null` → "don't touch" only
    // existed to protect against an admin that couldn't express regions at all (pre-4.4) — see
    // `TourInfoModel.regions`'s doc comment. `slug` is unused by the update mapping (`UpdateTour`
    // ignores it, matching by `RegionId`) — sent blank rather than threading the full region list
    // through just to fill a field nothing reads.
    regions: form.regions.map((r, i) => ({ id: r.serverId ?? NEW, regionId: r.regionId, slug: '', sortOrder: i })),
    // Always the real list too (never omitted) — same "the admin form can express it, so never
    // rely on the backend's null-means-untouched contract" reasoning as `regions` above.
    tags: form.tags.map((tg) => ({ id: tg.serverId ?? NEW, tagId: tg.tagId })),
  }
}

/** Parse a user-entered decimal string; empty/invalid becomes 0. */
function parseDecimal(value: string): number {
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/* -------------------------------------------------------------------------- */
/*  "Заполнить день из другого продукта" (F13 gap closure, part 2)             */
/* -------------------------------------------------------------------------- */

/** What a day-fill actually copies: text + route points (with their Place link). Deliberately
 * excludes price (stays the target day's own) and the gallery URLs themselves — a copied route
 * point's images are derived live from its `placeId` by the reducer's `fillDayFromSource` case
 * instead, the same live autofill a manual pick in `RoutePointPlaceSelect` triggers. */
export interface DaySourceContent {
  title: Localized
  shortDescription: Localized
  description: Localized
  duration: Localized
  routePoints: { text: Localized; placeId: number | null }[]
}

/** One pickable source in the "заполнить день из другого продукта" list — an excursion (its one
 * day IS the product) or one day of a multi-day tour. */
export interface DaySource {
  id: string
  tourTitle: Localized
  /** e.g. "День 2" — empty for an excursion, whose single day needs no sub-label. */
  dayLabel: string
  content: DaySourceContent
}

/** Flattens every non-archived product's day(s) into pickable sources. `excludeTourId` drops the
 * tour currently being edited — filling a day from itself is meaningless. */
export function toursToDaySources(tours: TourInfoModel[], excludeTourId?: number): DaySource[] {
  return tours
    .filter((t) => t.id !== excludeTourId)
    .flatMap((t) => {
      const tourTitle = readLocalized(t.translations, TourTranslationType.Title)
      const days = t.tourDays ?? []
      return days.map((day, i) => ({
        id: `${t.id}-${day.id}`,
        tourTitle,
        dayLabel: days.length > 1 ? `День ${i + 1}` : '',
        content: {
          title: readLocalized(day.translations ?? [], TourDayTranslationType.Title),
          shortDescription: readLocalized(day.translations ?? [], TourDayTranslationType.ShortDescription),
          description: readLocalized(day.translations ?? [], TourDayTranslationType.Description),
          duration: readLocalized(day.translations ?? [], TourDayTranslationType.Duration),
          routePoints: sortBySortOrder(day.routePoints ?? []).map((rp) => ({
            text: readLocalized(rp.translations ?? [], ExpenseTranslationType.Description),
            placeId: rp.placeId ?? null,
          })),
        },
      }))
    })
}

/** Whether a day (or, for an excursion, the tour-level fields standing in for its single day)
 * has anything a fill would overwrite — gates the "replace content?" confirm step. */
export function hasFillableDayContent(fields: {
  title: Localized
  shortDescription: Localized
  description: Localized
  duration: Localized
  routePoints: unknown[]
}): boolean {
  const filled = (loc: Localized) => Boolean(loc.ru.trim() || loc.en.trim())
  return (
    fields.routePoints.length > 0 ||
    filled(fields.title) ||
    filled(fields.shortDescription) ||
    filled(fields.description) ||
    filled(fields.duration)
  )
}
