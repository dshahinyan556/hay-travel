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
import { translate } from '@/shared/i18n/translate'
import type {
  AdditionalExpenseInfoModel,
  RoutePointInfoModel,
  TagInfoModel,
  TourCardModel,
  TourInfoModel,
  TourNoteInfoModel,
  TourRegionInfoModel,
  TourTagInfoModel,
  TranslatableInfoModel,
} from '@/shared/types/attours'
import type { ItineraryDay, Tour, TourDetail, TourKind, TourTag } from '@/shared/types/tour'

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

/** `TagType` on the backend — only this type carries `discountPercent` and changes price
 * display. */
const TAG_TYPE_DISCOUNT = 2

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
  return type === TOUR_TYPE_EXCURSION ? 'excursion' : 'tour'
}

function nightsFor(kind: TourKind, durationDays: number): number {
  return kind === 'excursion' ? 0 : Math.max(durationDays - 1, 0)
}

/** A hand-authored slug from `TourRegionInfoModel` is trusted data (3.2 confirmed 11/11 against
 * the frontend's own list), but this guards it anyway rather than letting `REGION_BY_SLUG[slug]`
 * read as `undefined` deep inside a component that assumes every entry resolves. */
function toRegionSlugs(regions: readonly TourRegionInfoModel[]): RegionSlug[] {
  return regions.map((r) => r.slug).filter((slug): slug is RegionSlug => slug in REGION_BY_SLUG)
}

/** Resolves a tour's flat `TourTagInfoModel[]` (just `tagId`s) against the tag catalog fetched
 * once per page (`getTagCatalog`) — same denormalization pattern as `toRegionSlugs`/
 * `REGION_BY_SLUG`. Sorted discount-first, then by the catalog's own `sortOrder`, matching the
 * card mockup's rule ("скидка всегда наверху"); a `tagId` the catalog doesn't know (deleted
 * between the two requests) is silently dropped rather than rendered blank. */
function mapTags(tourTags: readonly TourTagInfoModel[], catalog: readonly TagInfoModel[]): TourTag[] {
  const byId = new Map(catalog.map((tag) => [tag.id, tag]))
  const resolved = tourTags
    .map((tt) => byId.get(tt.tagId))
    .filter((tag): tag is TagInfoModel => tag !== undefined)

  const sorted = [...resolved].sort((a, b) => {
    const aRank = a.type === TAG_TYPE_DISCOUNT ? 0 : 1
    const bRank = b.type === TAG_TYPE_DISCOUNT ? 0 : 1
    return aRank !== bRank ? aRank - bRank : a.sortOrder - b.sortOrder
  })

  return sorted.map((tag) => {
    const isDiscount = tag.type === TAG_TYPE_DISCOUNT
    return {
      id: tag.id,
      isDiscount,
      discountPercent: tag.discountPercent,
      color: tag.color,
      // `label` is exactly the admin-typed name, verbatim — `discountPercent` is a
      // server-side price-calculation input, never composed into the shown text (David,
      // 2026-08-16). An admin who wants the percent visible on the pill types it into the
      // name itself (e.g. "Скидка 15%"), same as any other tag's wording.
      label: pickTranslation(tag.translations, TRANSLATION_SINGLE_FIELD),
    }
  })
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
    coverImage: card.mainImageUrl || FALLBACK_IMAGE,
    shortDescription: pickTranslation(card.translations, TRANSLATION_SHORT_DESCRIPTION),
    tags: mapTags(card.tags, tagCatalog),
  }
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
    coverImage,
    shortDescription: pickTranslation(info.translations, TRANSLATION_SHORT_DESCRIPTION),
    tags: mapTags(info.tags ?? [], tagCatalog),
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

/** Home page showcase — tours the admin marked `IsFeatured` (at most 6, `Продукты → Избранные`),
 * in their admin-set display order. Shows exactly however many are marked, including none: no
 * "first N tours" filler when the admin hasn't picked any yet (David, 2026-08-02). */
export async function getFeaturedTours(): Promise<readonly Tour[]> {
  const [cards, tagCatalog] = await Promise.all([
    apiFetch<TourCardModel[]>(`api/Tour/GetFeaturedToursClient?languageCode=${currentLanguageCode()}`),
    getTagCatalog(),
  ])
  return cards.map((card) => mapCard(card, tagCatalog))
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
