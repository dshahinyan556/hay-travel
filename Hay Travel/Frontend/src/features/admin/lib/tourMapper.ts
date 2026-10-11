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
  TourFormat,
  TourNoteType,
  TourTranslationType,
  TourType,
  TransferRoutePointKind,
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
  VehicleClassInfoModel,
} from '@/shared/types/attours'
import type {
  ExpenseFormState,
  GalleryItemFormState,
  Localized,
  LocalizedListItem,
  PlaceOption,
  RoutePointFormState,
  StartTimeFormState,
  TourDayFormState,
  TourFormState,
  TransferPriceFormState,
  TransferRoutePointFormState,
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

/** A fresh, empty start-time row. Blank rather than pre-filled: an admin adding a slot always
 * has a specific time in mind, and a default like "09:00" would silently save itself if they
 * clicked Add and got distracted. */
export const emptyStartTime = (): StartTimeFormState => ({
  key: newKey(),
  time: '',
})

/** A fresh transfer route point of the given role. `From`/`To` are created once when the form is
 * built (they are single-valued fields); `Stop` is what the add button produces. */
export const emptyTransferRoutePoint = (
  kind: TransferRoutePointFormState['kind'],
): TransferRoutePointFormState => ({
  key: newKey(),
  kind,
  text: emptyLocalized(),
})

export const emptyTransferStop = (): TransferRoutePointFormState =>
  emptyTransferRoutePoint(TransferRoutePointKind.Stop)

export const emptyTransferPrice = (): TransferPriceFormState => ({
  key: newKey(),
  vehicleClassId: null,
  oneWayPrice: '',
  roundTripPrice: '',
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
/*  Time of day: 'HH:mm:ss' (wire) <-> 'HH:mm' (form)                          */
/* -------------------------------------------------------------------------- */

/**
 * `TimeOnly` is serialized by System.Text.Json as `'HH:mm:ss'` (and `'HH:mm:ss.fffffff'` when it
 * carries sub-second precision, which start times never do). `<input type="time">` binds to
 * `'HH:mm'`, so the two are trimmed to each other here — the only place that knows either format.
 * Anything unparseable becomes `''`, which the form renders as an empty (invalid) row rather than
 * dropping the slot silently.
 */
export function wireTimeToForm(value: string | null | undefined): string {
  const match = /^(\d{2}):(\d{2})/.exec(value ?? '')
  return match ? `${match[1]}:${match[2]}` : ''
}

/** `'HH:mm'` -> `'HH:mm:00'`. Only called for values validation already accepted. */
export function formTimeToWire(value: string): string {
  return `${value}:00`
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

/** One pickable vehicle class in the transfer's price table. `capacity`/`luggageCapacity` are
 * shown next to the name so the admin prices the right class without opening the catalog;
 * `isActive` lets the picker hide retired classes while still naming one an existing price row
 * already points at. */
export interface VehicleClassOption {
  id: number
  name: Localized
  capacity: number
  luggageCapacity: number
  isActive: boolean
}

export function vehicleClassesToOptions(classes: VehicleClassInfoModel[]): VehicleClassOption[] {
  return sortBySortOrder(classes).map((vc) => ({
    id: vc.id,
    name: readLocalized(vc.translations, CATALOG_NAME_TYPE),
    capacity: vc.capacity,
    luggageCapacity: vc.luggageCapacity,
    isActive: vc.isActive,
  }))
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

/* ---- start times / transfer graph (shared by the create and edit directions) ---- */

/** Create rows carry no `id`, info rows do — one reader serves both, `serverId` simply stays
 * undefined for a freshly initialised skeleton. */
type AnyStartTime = { id?: number; time: string; sortOrder: number }
type AnyTransferRoutePoint = {
  id?: number
  kind: number
  sortOrder: number
  translations?: AnyTranslation[] | null
}
type AnyTransferPrice = {
  id?: number
  vehicleClassId: number
  oneWayPrice: number
  roundTripPrice: number
}

function readStartTimes(rows: AnyStartTime[] | null | undefined): StartTimeFormState[] {
  return sortBySortOrder(rows ?? []).map((row) => ({
    key: newKey(),
    serverId: row.id,
    time: wireTimeToForm(row.time),
  }))
}

function readTransferRoutePoint(row: AnyTransferRoutePoint): TransferRoutePointFormState {
  return {
    key: newKey(),
    serverId: row.id,
    kind: row.kind as TransferRoutePointFormState['kind'],
    text: readLocalized(row.translations ?? [], ExpenseTranslationType.Description),
  }
}

/**
 * Split the flat wire route into the form's three slots. The backend guarantees exactly one
 * `From` and one `To` on a saved transfer, but a tour/excursion has none at all and the create
 * skeleton could in principle come back short — a missing endpoint falls back to a blank point so
 * the form always has something to bind to (validation then flags it as empty).
 */
function readTransferRoute(rows: AnyTransferRoutePoint[] | null | undefined): {
  from: TransferRoutePointFormState
  stops: TransferRoutePointFormState[]
  to: TransferRoutePointFormState
} {
  const ordered = sortBySortOrder(rows ?? [])
  const from = ordered.find((r) => r.kind === TransferRoutePointKind.From)
  const to = ordered.find((r) => r.kind === TransferRoutePointKind.To)
  return {
    from: from ? readTransferRoutePoint(from) : emptyTransferRoutePoint(TransferRoutePointKind.From),
    stops: ordered.filter((r) => r.kind === TransferRoutePointKind.Stop).map(readTransferRoutePoint),
    to: to ? readTransferRoutePoint(to) : emptyTransferRoutePoint(TransferRoutePointKind.To),
  }
}

function readTransferPrices(rows: AnyTransferPrice[] | null | undefined): TransferPriceFormState[] {
  return (rows ?? []).map((row) => ({
    key: newKey(),
    serverId: row.id,
    vehicleClassId: row.vehicleClassId,
    oneWayPrice: String(row.oneWayPrice),
    roundTripPrice: String(row.roundTripPrice),
  }))
}

/** Form -> wire for the route: `From`, then the stops in their display order, then `To`. One
 * flat, densely numbered list — the backend reconciles it by id and re-reads `kind`/`sortOrder`
 * as given. */
function writeTransferRoute(form: TourFormState): TransferRoutePointFormState[] {
  return [
    { ...form.transferFrom, kind: TransferRoutePointKind.From },
    ...form.transferStops.map((s) => ({ ...s, kind: TransferRoutePointKind.Stop })),
    { ...form.transferTo, kind: TransferRoutePointKind.To },
  ]
}

/** Build the create form from the `InitTour` skeleton (translations pre-seeded as null). */
export function createModelToForm(dto: TourCreateModel): TourFormState {
  // Старый бэкенд этих полей не прислал бы вовсе, поэтому `Partial`, а не прямое чтение:
  // скелет с пустым форматом должен открываться как «индивидуальный», а не падать.
  const wire = dto as Partial<TourCreateModel>
  const type = (dto.type as TourType) ?? TourType.Tour
  const route = readTransferRoute(wire.transferRoutePoints)
  return {
    type,
    // A tour/excursion always has a format; the skeleton seeds `Individual`, and an older backend
    // that sends nothing gets the same default rather than an unsaveable blank radio group.
    format: type === TourType.Transfer ? null : ((wire.format as TourFormat) ?? TourFormat.Individual),
    groupPricePerPerson: wire.groupPricePerPerson == null ? '' : String(wire.groupPricePerPerson),
    groupCapacity: wire.groupCapacity == null ? '' : String(wire.groupCapacity),
    startTimes: readStartTimes(wire.startTimes),
    transferFrom: route.from,
    transferStops: route.stops,
    transferTo: route.to,
    transferPrices: readTransferPrices(wire.transferPrices),
    mainImageUrl: dto.mainImageUrl ?? '',
    isActive: dto.isActive,
    // Скелет `InitTour` этого поля не несёт: новый продукт в «Избранное» не входит, пока админ
    // не отметит галочку — тогда `useTourForm` вызывает `SetFeatured` сразу после создания.
    isFeatured: false,
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
  const type = dto.type as TourType
  const route = readTransferRoute(dto.transferRoutePoints)
  return {
    type,
    // Products created before the batch have no format stored; the migration back-fills
    // `Individual`, and this mirrors it so an un-migrated record still opens on a valid radio.
    format: type === TourType.Transfer ? null : ((dto.format as TourFormat) ?? TourFormat.Individual),
    groupPricePerPerson: dto.groupPricePerPerson == null ? '' : String(dto.groupPricePerPerson),
    groupCapacity: dto.groupCapacity == null ? '' : String(dto.groupCapacity),
    startTimes: readStartTimes(dto.startTimes),
    transferFrom: route.from,
    transferStops: route.stops,
    transferTo: route.to,
    transferPrices: readTransferPrices(dto.transferPrices),
    mainImageUrl: dto.mainImageUrl ?? '',
    isActive: dto.isActive,
    isFeatured: dto.isFeatured,
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

/**
 * The type/format-dependent slice of the payload, identical for create and update.
 *
 * Three domain rules are enforced here rather than by hoping the UI never produces a stale value
 * (switching the type mid-create leaves the previous branch's data in state on purpose, so the
 * admin can switch back without retyping):
 *  - a transfer has NO format, NO group pricing, NO start times, and no days/notes/expenses/
 *    regions/tags/discount — the backend rejects all of them (`TourValidationService`);
 *  - a tour/excursion has no transfer route and no transfer prices;
 *  - group pricing is sent only for `Group`/`Both`; at `Individual` both fields go as `null`,
 *    which is exactly what `InvalidGroupPricing`/2051 checks.
 */
function typeDependentFields(form: TourFormState) {
  const transfer = form.type === TourType.Transfer
  const grouped = form.format === TourFormat.Group || form.format === TourFormat.Both
  return {
    format: transfer ? null : form.format,
    groupPricePerPerson:
      !transfer && grouped && form.groupPricePerPerson.trim() !== ''
        ? parseDecimal(form.groupPricePerPerson)
        : null,
    groupCapacity:
      !transfer && grouped && form.groupCapacity.trim() !== ''
        ? parseInteger(form.groupCapacity)
        : null,
    /** The form rows themselves (not wire rows) — the two directions need different id handling. */
    startTimes: transfer ? [] : form.startTimes,
    /** Only a transfer sends a route — and it always sends the full one. */
    transferRoute: transfer ? writeTransferRoute(form) : [],
    transferPrices: transfer ? form.transferPrices : [],
    /** A transfer keeps its main image and texts; everything else in the "rich" half is dropped. */
    days: transfer ? [] : form.days,
    notes: transfer
      ? { organizationalDetails: [], restrictions: [], included: [], notIncluded: [] }
      : {
          organizationalDetails: form.organizationalDetails,
          restrictions: form.restrictions,
          included: form.included,
          notIncluded: form.notIncluded,
        },
    additionalExpenses: transfer ? [] : form.additionalExpenses,
    regions: transfer ? [] : form.regions,
    tags: transfer ? [] : form.tags,
    discountPercent:
      transfer || form.discountPercent.trim() === '' ? null : parseDecimal(form.discountPercent),
    discountStartDate: transfer || form.discountStartDate.trim() === '' ? null : form.discountStartDate,
    discountValidUntil:
      transfer || form.discountValidUntil.trim() === '' ? null : form.discountValidUntil,
  }
}

/** Assemble the create payload. Emits no ids; derives sortOrder from array index. */
export function formToCreateModel(form: TourFormState): TourCreateModel {
  const typed = typeDependentFields(form)
  return {
    type: form.type,
    format: typed.format,
    groupPricePerPerson: typed.groupPricePerPerson,
    groupCapacity: typed.groupCapacity,
    startTimes: typed.startTimes.map((slot, i) => ({
      time: formTimeToWire(slot.time),
      sortOrder: i,
    })),
    transferRoutePoints: typed.transferRoute.map((rp, i) => ({
      kind: rp.kind,
      sortOrder: i,
      translations: writeLocalized(ExpenseTranslationType.Description, rp.text),
    })),
    transferPrices: typed.transferPrices.map((row) => ({
      vehicleClassId: row.vehicleClassId ?? 0,
      oneWayPrice: parseDecimal(row.oneWayPrice),
      roundTripPrice: parseDecimal(row.roundTripPrice),
    })),
    mainImageUrl: form.mainImageUrl.trim() === '' ? null : form.mainImageUrl.trim(),
    isActive: form.isActive,
    requiresPrepayment: form.requiresPrepayment,
    discountPercent: typed.discountPercent,
    discountStartDate: typed.discountStartDate,
    discountValidUntil: typed.discountValidUntil,
    translations: [
      ...writeLocalized(TourTranslationType.Title, form.title),
      ...writeLocalized(TourTranslationType.ShortDescription, form.shortDescription),
      ...writeLocalized(TourTranslationType.Description, form.description),
      ...writeLocalized(TourTranslationType.Duration, form.duration),
    ],
    tourDays: typed.days.map((day) => {
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
    additionalExpenses: typed.additionalExpenses.map((e) => ({
      amount: e.amount.trim() === '' ? null : parseDecimal(e.amount),
      translations: writeLocalized(ExpenseTranslationType.Description, e.description),
    })),
    notes: [
      ...typed.notes.organizationalDetails.map((o, i) => ({
        type: TourNoteType.OrganizationalDetail,
        sortOrder: i,
        translations: writeLocalized(ExpenseTranslationType.Description, o.text),
      })),
      ...typed.notes.restrictions.map((o, i) => ({
        type: TourNoteType.Restriction,
        sortOrder: i,
        translations: writeLocalized(ExpenseTranslationType.Description, o.text),
      })),
      ...typed.notes.included.map((o, i) => ({
        type: TourNoteType.Included,
        sortOrder: i,
        translations: writeLocalized(ExpenseTranslationType.Description, o.text),
      })),
      ...typed.notes.notIncluded.map((o, i) => ({
        type: TourNoteType.NotIncluded,
        sortOrder: i,
        translations: writeLocalized(ExpenseTranslationType.Description, o.text),
      })),
    ],
    regions: typed.regions.map((r, i) => ({ regionId: r.regionId, sortOrder: i })),
    tags: typed.tags.map((tg) => ({ tagId: tg.tagId })),
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
  const typed = typeDependentFields(form)
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
    format: typed.format,
    groupPricePerPerson: typed.groupPricePerPerson,
    groupCapacity: typed.groupCapacity,
    // Start times, the transfer route and the transfer prices are reconciled by id like the rest
    // of the graph — `null` is NOT "leave alone" for them (only `regions`/`tags` have that
    // exception), so the real list is always sent, empty included.
    startTimes: typed.startTimes.map((slot, i) => ({
      id: slot.serverId ?? NEW,
      time: formTimeToWire(slot.time),
      sortOrder: i,
    })),
    transferRoutePoints: typed.transferRoute.map((rp, i) => ({
      id: rp.serverId ?? NEW,
      kind: rp.kind,
      sortOrder: i,
      translations: asInfoTranslations(writeLocalized(ExpenseTranslationType.Description, rp.text)),
    })),
    transferPrices: typed.transferPrices.map((row) => ({
      id: row.serverId ?? NEW,
      vehicleClassId: row.vehicleClassId ?? 0,
      oneWayPrice: parseDecimal(row.oneWayPrice),
      roundTripPrice: parseDecimal(row.roundTripPrice),
    })),
    discountPercent: typed.discountPercent,
    discountStartDate: typed.discountStartDate,
    discountValidUntil: typed.discountValidUntil,
    mainImageUrl: form.mainImageUrl.trim() === '' ? null : form.mainImageUrl.trim(),
    translations: asInfoTranslations([
      ...writeLocalized(TourTranslationType.Title, form.title),
      ...writeLocalized(TourTranslationType.ShortDescription, form.shortDescription),
      ...writeLocalized(TourTranslationType.Description, form.description),
      ...writeLocalized(TourTranslationType.Duration, form.duration),
    ]),
    tourDays: typed.days.map((day) => {
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
    additionalExpenses: typed.additionalExpenses.map((e) => ({
      id: e.serverId ?? NEW,
      amount: e.amount.trim() === '' ? null : parseDecimal(e.amount),
      translations: asInfoTranslations(writeLocalized(ExpenseTranslationType.Description, e.description)),
    })),
    notes: [
      ...typed.notes.organizationalDetails.map((o, i) => ({
        id: o.serverId ?? NEW,
        type: TourNoteType.OrganizationalDetail,
        sortOrder: i,
        translations: asInfoTranslations(writeLocalized(ExpenseTranslationType.Description, o.text)),
      })),
      ...typed.notes.restrictions.map((o, i) => ({
        id: o.serverId ?? NEW,
        type: TourNoteType.Restriction,
        sortOrder: i,
        translations: asInfoTranslations(writeLocalized(ExpenseTranslationType.Description, o.text)),
      })),
      ...typed.notes.included.map((o, i) => ({
        id: o.serverId ?? NEW,
        type: TourNoteType.Included,
        sortOrder: i,
        translations: asInfoTranslations(writeLocalized(ExpenseTranslationType.Description, o.text)),
      })),
      ...typed.notes.notIncluded.map((o, i) => ({
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
    regions: typed.regions.map((r, i) => ({ id: r.serverId ?? NEW, regionId: r.regionId, slug: '', sortOrder: i })),
    // Always the real list too (never omitted) — same "the admin form can express it, so never
    // rely on the backend's null-means-untouched contract" reasoning as `regions` above.
    tags: typed.tags.map((tg) => ({ id: tg.serverId ?? NEW, tagId: tg.tagId })),
  }
}

/** Parse a user-entered decimal string; empty/invalid becomes 0. */
function parseDecimal(value: string): number {
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/** Parse a user-entered whole number (seats). Empty/invalid becomes 0 — validation has already
 * rejected those before a submit can reach here. */
function parseInteger(value: string): number {
  const n = Number.parseInt(value.trim(), 10)
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
 * tour currently being edited — filling a day from itself is meaningless.
 *
 * `dayLabel` formats the "День 2"/"Day 2" sub-label. It is a parameter rather than a literal
 * because this function is pure and runs inside a route loader, where there is no `useCopy` —
 * the caller passes `tourFormCopy(locale).days.label` (ADR 021). */
export function toursToDaySources(
  tours: TourInfoModel[],
  dayLabel: (index: number) => string,
  excludeTourId?: number,
): DaySource[] {
  return tours
    .filter((t) => t.id !== excludeTourId)
    .flatMap((t) => {
      const tourTitle = readLocalized(t.translations, TourTranslationType.Title)
      const days = t.tourDays ?? []
      return days.map((day, i) => ({
        id: `${t.id}-${day.id}`,
        tourTitle,
        dayLabel: days.length > 1 ? dayLabel(i + 1) : '',
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
