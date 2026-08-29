/**
 * Public-site tour data — talks to the real backend (stage 5).
 *
 * This is the ONLY module that knows the wire shape (`shared/types/attours.ts`'s
 * `TourCardModel`/`TourInfoModel`). Route loaders and components only ever see `Tour`/
 * `TourDetail` (`shared/types/tour.ts`) — the mapping between the two lives entirely here, so a
 * future backend contract change (a real `Slug`, real ratings, …) only touches this file.
 *
 * Every call is pinned to the visitor's current locale (`getStoredLocale`, `shared/lib/locale`)
 * via `LanguageCode` — a plain, synchronous read rather than a hook, since route loaders run
 * outside React. `RootLayout`'s `useRevalidateOnLocaleChange` re-runs the active loader whenever
 * `LanguageSwitch` flips the pill, so these calls always end up re-fetched in the new language.
 */

import { apiFetch, ApiError } from '@/shared/lib/http'
import { REGION_BY_SLUG, type RegionSlug } from '@/shared/data/armeniaRegions'
import { getStoredLocale, LANGUAGE_CODE_BY_LOCALE } from '@/shared/lib/locale'
import { getTransfers } from './transfers'
import { transferPointOf, type TransferSummary } from '@/shared/types/transfer'
import { translate } from '@/shared/i18n/translate'
import type {
  AdditionalExpenseInfoModel,
  RoutePointInfoModel,
  TagInfoModel,
  TourCardModel,
  TourInfoModel,
  TourNoteInfoModel,
  TourRegionInfoModel,
  TourStartTimeInfoModel,
  TourTagInfoModel,
  TranslatableInfoModel,
} from '@/shared/types/attours'
import type {
  ItineraryDay,
  Tour,
  TourDetail,
  TourDiscountWindow,
  TourKind,
  TourStartTime,
  TourTag,
} from '@/shared/types/tour'
import { TourFormat } from '@/shared/types/tourFormat'
import { toDisplayTime } from '@/shared/booking'

function currentLanguageCode(): number {
  return LANGUAGE_CODE_BY_LOCALE[getStoredLocale()]
}

/** `TourTranslationType`/`TourDayTranslationType` on the backend — both enums share the same
 * numbering, so one local map covers tour- and day-level translations alike. */
const TRANSLATION_TITLE = 1
const TRANSLATION_SHORT_DESCRIPTION = 2
const TRANSLATION_DESCRIPTION = 3

/** `TourType` on the backend. */
const TOUR_TYPE_EXCURSION = 2
const TOUR_TYPE_TRANSFER = 3

/** `TourFormat` пришедшее с провода — число, и оно может быть любым: `null` у продукта,
 * созданного до батча 2026-08-29, и значение вне enum'а у клиента, отставшего от бэка. И то,
 * и другое читается как «формата нет» → индивидуальный (`resolveEffectiveFormat`), а не как
 * повод показать бейдж с пустой подписью. */
function toFormat(raw: number | null | undefined): TourFormat | null {
  return raw === TourFormat.Individual || raw === TourFormat.Group || raw === TourFormat.Both
    ? raw
    : null
}

/** Времена старта в порядке, который задал админ (бэк уже отдаёт их по `sortOrder`). Строки,
 * которые не разбираются как `HH:mm`, выбрасываются: пустая «кнопка времени» хуже, чем на одну
 * кнопку меньше, а полностью пустой список блок брони обрабатывает отдельной веткой. */
function mapStartTimes(startTimes: readonly TourStartTimeInfoModel[] | undefined): TourStartTime[] {
  return (startTimes ?? [])
    .map((startTime) => ({ id: startTime.id, time: toDisplayTime(startTime.time) }))
    .filter((startTime) => startTime.time !== '')
}

/** `TourNoteType` on the backend. */
const NOTE_TYPE_ORGANIZATIONAL_DETAIL = 1
const NOTE_TYPE_RESTRICTION = 2
const NOTE_TYPE_INCLUDED = 3
const NOTE_TYPE_NOT_INCLUDED = 4

/** Route points, expenses and notes each carry a single textual field, always `type: 0` — see
 * the admin mapper's identical convention in `features/admin/catalog/lib/catalogMapper.ts`. */
const TRANSLATION_SINGLE_FIELD = 0

/** Generated placeholder scene, same one the mocks used — shown when a tour has no photo yet. */
const FALLBACK_IMAGE = '/placeholders/tatev.svg'

function pickTranslation(translations: readonly TranslatableInfoModel[], type: number): string {
  return translations.find((t) => t.type === type)?.value ?? ''
}

function toKind(type: number): TourKind {
  if (type === TOUR_TYPE_EXCURSION) return 'excursion'
  if (type === TOUR_TYPE_TRANSFER) return 'transfer'
  return 'tour'
}

function nightsFor(kind: TourKind, durationDays: number): number {
  return kind === 'tour' ? Math.max(durationDays - 1, 0) : 0
}

/** A hand-authored slug from `TourRegionInfoModel` is trusted data (3.2 confirmed 11/11 against
 * the frontend's own list), but this guards it anyway rather than letting `REGION_BY_SLUG[slug]`
 * read as `undefined` deep inside a component that assumes every entry resolves. */
function toRegionSlugs(regions: readonly TourRegionInfoModel[]): RegionSlug[] {
  return regions.map((r) => r.slug).filter((slug): slug is RegionSlug => slug in REGION_BY_SLUG)
}

/** Resolves a tour's flat `TourTagInfoModel[]` (just `tagId`s) against the tag catalog fetched
 * once per page (`getTagCatalog`) — same denormalization pattern as `toRegionSlugs`/
 * `REGION_BY_SLUG`. Sorted by the catalog's own `sortOrder`; a `tagId` the catalog doesn't know
 * (deleted between the two requests) is silently dropped rather than rendered blank. */
function mapTags(tourTags: readonly TourTagInfoModel[], catalog: readonly TagInfoModel[]): TourTag[] {
  const byId = new Map(catalog.map((tag) => [tag.id, tag]))
  const resolved = tourTags
    .map((tt) => byId.get(tt.tagId))
    .filter((tag): tag is TagInfoModel => tag !== undefined)

  const sorted = [...resolved].sort((a, b) => a.sortOrder - b.sortOrder)

  return sorted.map((tag) => ({
    id: tag.id,
    color: tag.color,
    label: pickTranslation(tag.translations, TRANSLATION_SINGLE_FIELD),
  }))
}

/** Per-language session cache (2026-08-16, same pattern as `getContentText` in
 * `shared/api/siteSettings.ts`) — `HomePage`'s loader alone fires this from both
 * `getFeaturedTours` and `getToursByRegion`/`getTours` side by side, and a plain page-to-page
 * navigation calls it again. Kept for the SPA session per language (evicted only on failure, so a
 * transient network error doesn't wedge every tag out for the rest of the session) — the catalog
 * changes only when an admin edits it in Справочники, a switched-tab reload is an acceptable way
 * to pick that up. */
const tagCatalogCache = new Map<number, Promise<TagInfoModel[]>>()

/** The tag catalog (name/color/type/percent per tag), one request per page — every tour on that
 * page resolves its `TourTagInfoModel[]` against this same list rather than each carrying its
 * own copy. */
export function getTagCatalog(): Promise<TagInfoModel[]> {
  const languageCode = currentLanguageCode()
  const cached = tagCatalogCache.get(languageCode)
  if (cached) return cached

  const promise = apiFetch<TagInfoModel[]>(`api/Tag/GetForClient?languageCode=${languageCode}`)
  tagCatalogCache.set(languageCode, promise)
  promise.catch(() => tagCatalogCache.delete(languageCode))
  return promise
}

function mapCard(card: TourCardModel, tagCatalog: readonly TagInfoModel[]): Tour {
  const kind = toKind(card.type)
  return {
    id: String(card.id),
    title: pickTranslation(card.translations, TRANSLATION_TITLE),
    kind,
    regionSlugs: toRegionSlugs(card.regions),
    durationDays: card.durationDays,
    durationNights: nightsFor(kind, card.durationDays),
    priceFrom: card.totalPrice ?? 0,
    discountedPrice: card.discountedPrice,
    discountStartDate: card.discountStartDate,
    discountValidUntil: card.discountValidUntil,
    coverImage: card.mainImageUrl || FALLBACK_IMAGE,
    shortDescription: pickTranslation(card.translations, TRANSLATION_SHORT_DESCRIPTION),
    tags: mapTags(card.tags, tagCatalog),
    format: toFormat(card.format),
    transferRoute: null,
    groupPricePerPerson: card.groupPricePerPerson,
  }
}

/**
 * The raw discount range of a tour, for the booking calendar's "-N%" ribbon (`TourDiscountWindow`).
 *
 * `null` unless there is a real range to draw: the backend enforces "percent + end together or
 * neither", so a partial trio means an old row and is treated as "no discount" rather than
 * guessed at. `discountStartDate` is the one member that may legitimately be missing on its own —
 * rows predating the column — and that means "no lower bound", not "no discount"
 * (`TourDiscountExtensions.IsDiscountActive`).
 *
 * Note this does NOT check whether the campaign is live today. That is `discountedPrice`'s job;
 * a window starting next month is exactly what the calendar has to be able to show.
 */
function toDiscountWindow(info: TourInfoModel): TourDiscountWindow | null {
  const percent = info.discountPercent
  const endDate = info.discountValidUntil
  if (percent == null || percent <= 0 || !endDate) return null
  return { percent, startDate: info.discountStartDate ?? null, endDate }
}

function sortedRoutePoints(points: readonly RoutePointInfoModel[]): string[] {
  return [...points]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p) => pickTranslation(p.translations, TRANSLATION_SINGLE_FIELD))
    .filter((value) => value !== '')
}

function notesOfType(notes: readonly TourNoteInfoModel[], type: number): string[] {
  return notes
    .filter((n) => n.type === type)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((n) => pickTranslation(n.translations, TRANSLATION_SINGLE_FIELD))
    .filter((value) => value !== '')
}

function mapExpenses(expenses: readonly AdditionalExpenseInfoModel[]) {
  return expenses.map((e) => ({
    label: pickTranslation(e.translations, TRANSLATION_SINGLE_FIELD),
    amount: e.amount,
  }))
}

function mapDetail(info: TourInfoModel, tagCatalog: readonly TagInfoModel[]): TourDetail {
  const kind = toKind(info.type)
  const durationDays = info.tourDays.length
  const coverImage = info.mainImageUrl || FALLBACK_IMAGE

  const locale = getStoredLocale()
  const itinerary: ItineraryDay[] = info.tourDays.map((day, index) => ({
    day: index + 1,
    title:
      pickTranslation(day.translations, TRANSLATION_TITLE) ||
      translate(locale, 'tourDetail.dayFallback', { n: index + 1 }),
    description: pickTranslation(day.translations, TRANSLATION_DESCRIPTION),
    routePoints: sortedRoutePoints(day.routePoints),
  }))

  const gallery = info.tourDays.flatMap((day) =>
    [...day.galleryImages].sort((a, b) => a.sortOrder - b.sortOrder).map((img) => img.url),
  )

  return {
    id: String(info.id),
    title: pickTranslation(info.translations, TRANSLATION_TITLE),
    kind,
    regionSlugs: toRegionSlugs(info.regions ?? []),
    durationDays,
    durationNights: nightsFor(kind, durationDays),
    priceFrom: info.totalPrice ?? 0,
    discountedPrice: info.discountedPrice ?? null,
    discountStartDate: info.discountStartDate ?? null,
    discountValidUntil: info.discountValidUntil ?? null,
    discountWindow: toDiscountWindow(info),
    coverImage,
    shortDescription: pickTranslation(info.translations, TRANSLATION_SHORT_DESCRIPTION),
    tags: mapTags(info.tags ?? [], tagCatalog),
    format: toFormat(info.format),
    // Детальная трансфера — своя страница и своя модель (`shared/types/transfer.ts`); сюда
    // трансфер не доезжает вовсе: `GetTourInfo` отвечает на него 404.
    transferRoute: null,
    groupPricePerPerson: info.groupPricePerPerson ?? null,
    groupCapacity: info.groupCapacity ?? null,
    startTimes: mapStartTimes(info.startTimes),
    requiresPrepayment: info.requiresPrepayment,
    gallery: gallery.length > 0 ? gallery : [coverImage],
    itinerary,
    organizationalDetails: notesOfType(info.notes, NOTE_TYPE_ORGANIZATIONAL_DETAIL),
    restrictions: notesOfType(info.notes, NOTE_TYPE_RESTRICTION),
    included: notesOfType(info.notes, NOTE_TYPE_INCLUDED),
    notIncluded: notesOfType(info.notes, NOTE_TYPE_NOT_INCLUDED),
    expenses: mapExpenses(info.additionalExpenses),
  }
}

export async function getTours(): Promise<readonly Tour[]> {
  const [cards, tagCatalog] = await Promise.all([
    apiFetch<TourCardModel[]>(`api/Tour/GetToursClient?languageCode=${currentLanguageCode()}`),
    getTagCatalog(),
  ])
  return cards.map((card) => mapCard(card, tagCatalog))
}

/**
 * Home page showcase — products the admin marked `IsFeatured` (at most 9 since 2026-08-29,
 * `Продукты → Избранные`), in their admin-set display order. Shows exactly however many are
 * marked, including none: no "first N tours" filler when the admin hasn't picked any yet
 * (David, 2026-08-02).
 *
 * ── Трансферы в избранном (решение 0.4, пункт 6.8) ────────────────────────────────────────────
 * `GetFeaturedToursClient` фильтра по типу НЕ имеет, поэтому сюда приходят и трансферы. Но
 * `TourCardModel` описывает тур: у трансфера в нём нет ни маршрута, ни цены (`TotalPrice` — это
 * сумма цен ДНЕЙ, а у трансфера дней нет, цена живёт на классах авто). Карточка с «от 0 ֏» и
 * пустой строкой регионов — это не «трансфер отображается», это витрина с браком.
 *
 * Поэтому недостающее добирается из публичного списка трансферов — того самого, что уже
 * обслуживает `/transfers`. Запрос делается ТОЛЬКО если в избранном реально есть трансфер, и
 * его сбой не роняет секцию: карточка тогда просто останется без цены и маршрута.
 */
export async function getFeaturedTours(): Promise<readonly Tour[]> {
  const [cards, tagCatalog] = await Promise.all([
    apiFetch<TourCardModel[]>(`api/Tour/GetFeaturedToursClient?languageCode=${currentLanguageCode()}`),
    getTagCatalog(),
  ])

  const mapped = cards.map((card) => mapCard(card, tagCatalog))
  if (!mapped.some((product) => product.kind === 'transfer')) return mapped

  const transfers = await getTransfers().catch(() => [] as readonly TransferSummary[])
  if (transfers.length === 0) return mapped

  const byId = new Map(transfers.map((transfer) => [transfer.id, transfer]))
  return mapped.map((product) => {
    const transfer = product.kind === 'transfer' ? byId.get(product.id) : undefined
    if (!transfer) return product
    return {
      ...product,
      priceFrom: transfer.priceFrom ?? product.priceFrom,
      transferRoute: [transferPointOf(transfer.route, 'from'), transferPointOf(transfer.route, 'to')]
        .filter((point) => point !== ''),
    }
  })
}

/** `undefined` for a 404 (hidden or nonexistent id) — same contract the mock had, so
 * `tourDetailLoader`'s "not found" branch needs no change. Any other failure (network, 5xx)
 * still throws, which the route's `errorElement` already handles. */
export async function getTourInfo(id: string): Promise<TourDetail | undefined> {
  try {
    const [info, tagCatalog] = await Promise.all([
      apiFetch<TourInfoModel>(
        `api/Tour/GetTourInfo?id=${encodeURIComponent(id)}&languageCode=${currentLanguageCode()}`,
      ),
      getTagCatalog(),
    ])
    return mapDetail(info, tagCatalog)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return undefined
    throw err
  }
}

/** Region tours are fetched per selection (not sliced from an already-loaded list) because that
 * is what the real `?region=` filter on `GetToursClient` does — `RegionExplorer`'s
 * loading/error states are the ones that actually run in production, not decoration. */
export async function getToursByRegion(region: RegionSlug): Promise<readonly Tour[]> {
  const [cards, tagCatalog] = await Promise.all([
    apiFetch<TourCardModel[]>(
      `api/Tour/GetToursClient?languageCode=${currentLanguageCode()}&region=${encodeURIComponent(region)}`,
    ),
    getTagCatalog(),
  ])
  return cards.map((card) => mapCard(card, tagCatalog))
}

/**
 * How many products each region has — drives the map tooltip counters and dims regions
 * with nothing to sell. Computed synchronously from an already-loaded list (the map needs it
 * to paint its initial state) rather than a server round trip.
 */
export function countToursByRegion(tours: readonly Tour[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const tour of tours) {
    for (const region of tour.regionSlugs) {
      counts[region] = (counts[region] ?? 0) + 1
    }
  }
  return counts
}
