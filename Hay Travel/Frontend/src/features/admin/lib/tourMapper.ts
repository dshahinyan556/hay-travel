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
  TourTranslationType,
  TourType,
} from '@/features/admin/lib/enums'
import type {
  TourCreateModel,
  TourDayCreateModel,
  TourInfoModel,
  TourDayInfoModel,
  TranslatableCreateModel,
  TranslatableInfoModel,
} from '@/shared/types/attours'
import type {
  ExpenseFormState,
  GalleryItemFormState,
  Localized,
  LocalizedListItem,
  TourDayFormState,
  TourFormState,
} from '@/features/admin/types/form'

/* -------------------------------------------------------------------------- */
/*  Empty factories                                                            */
/* -------------------------------------------------------------------------- */

const newKey = (): string => crypto.randomUUID()

export const emptyLocalized = (): Localized => ({ ru: '', en: '' })

/** Route points, organizational details and restrictions all share the LocalizedListItem
 * shape, so one factory serves all three (exported under intention-revealing aliases). */
export const emptyLocalizedItem = (): LocalizedListItem => ({
  key: newKey(),
  text: emptyLocalized(),
})

export const emptyRoutePoint = emptyLocalizedItem
export const emptyOrganizationalDetail = emptyLocalizedItem
export const emptyRestriction = emptyLocalizedItem

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
    title: readLocalized(dto.translations, TourTranslationType.Title),
    shortDescription: readLocalized(dto.translations, TourTranslationType.ShortDescription),
    description: readLocalized(dto.translations, TourTranslationType.Description),
    duration: readLocalized(dto.translations, TourTranslationType.Duration),
    organizationalDetails: (dto.organizationalDetails ?? []).map((o) => ({
      key: newKey(),
      text: readLocalized(o.translations ?? [], ExpenseTranslationType.Description),
    })),
    restrictions: (dto.restrictions ?? []).map((o) => ({
      key: newKey(),
      text: readLocalized(o.translations ?? [], ExpenseTranslationType.Description),
    })),
    days: (dto.tourDays ?? []).map(createDayToForm),
    additionalExpenses: (dto.additionalExpenses ?? []).map((e) => ({
      key: newKey(),
      amount: e.amount == null ? '' : String(e.amount),
      description: readLocalized(e.translations ?? [], ExpenseTranslationType.Description),
    })),
  }
}

/** Build the edit form from `InitUpdate`, carrying server ids for the update diff later. */
export function infoToForm(dto: TourInfoModel): TourFormState {
  return {
    type: dto.type as TourType,
    mainImageUrl: dto.mainImageUrl ?? '',
    isActive: dto.isActive,
    title: readLocalized(dto.translations, TourTranslationType.Title),
    shortDescription: readLocalized(dto.translations, TourTranslationType.ShortDescription),
    description: readLocalized(dto.translations, TourTranslationType.Description),
    duration: readLocalized(dto.translations, TourTranslationType.Duration),
    organizationalDetails: sortBySortOrder(dto.organizationalDetails ?? []).map((o) => ({
      key: newKey(),
      serverId: o.id,
      text: readLocalized(o.translations ?? [], ExpenseTranslationType.Description),
    })),
    restrictions: sortBySortOrder(dto.restrictions ?? []).map((o) => ({
      key: newKey(),
      serverId: o.id,
      text: readLocalized(o.translations ?? [], ExpenseTranslationType.Description),
    })),
    days: (dto.tourDays ?? []).map(infoDayToForm),
    additionalExpenses: (dto.additionalExpenses ?? []).map((e) => ({
      key: newKey(),
      serverId: e.id,
      amount: e.amount == null ? '' : String(e.amount),
      description: readLocalized(e.translations ?? [], ExpenseTranslationType.Description),
    })),
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
    })),
    gallery: (day.galleryImages ?? []).map((g) => ({ key: newKey(), url: g.url })),
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
    })),
    gallery: byOrder(day.galleryImages ?? []).map((g) => ({
      key: newKey(),
      serverId: g.id,
      url: g.url,
    })),
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
          translations: writeLocalized(ExpenseTranslationType.Description, rp.text),
        })),
      }
    }) satisfies TourDayCreateModel[],
    additionalExpenses: form.additionalExpenses.map((e) => ({
      amount: e.amount.trim() === '' ? null : parseDecimal(e.amount),
      translations: writeLocalized(ExpenseTranslationType.Description, e.description),
    })),
    organizationalDetails: form.organizationalDetails.map((o, i) => ({
      sortOrder: i,
      translations: writeLocalized(ExpenseTranslationType.Description, o.text),
    })),
    restrictions: form.restrictions.map((o, i) => ({
      sortOrder: i,
      translations: writeLocalized(ExpenseTranslationType.Description, o.text),
    })),
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
    // Ignored by UpdateTour (archive/restore go through SetArchived); present only to satisfy the
    // wire type. Kept `false` — the update endpoint never reads it.
    isArchived: false,
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
        translations: asInfoTranslations(writeLocalized(ExpenseTranslationType.Description, rp.text)),
      })),
      }
    }),
    additionalExpenses: form.additionalExpenses.map((e) => ({
      id: e.serverId ?? NEW,
      amount: e.amount.trim() === '' ? null : parseDecimal(e.amount),
      translations: asInfoTranslations(writeLocalized(ExpenseTranslationType.Description, e.description)),
    })),
    organizationalDetails: form.organizationalDetails.map((o, i) => ({
      id: o.serverId ?? NEW,
      sortOrder: i,
      translations: asInfoTranslations(writeLocalized(ExpenseTranslationType.Description, o.text)),
    })),
    restrictions: form.restrictions.map((o, i) => ({
      id: o.serverId ?? NEW,
      sortOrder: i,
      translations: asInfoTranslations(writeLocalized(ExpenseTranslationType.Description, o.text)),
    })),
  }
}

/** Parse a user-entered decimal string; empty/invalid becomes 0. */
function parseDecimal(value: string): number {
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
