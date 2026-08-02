/**
 * Region teaser ("blurb") text — admin-editable since 2026-08-02 (`Настройки → Справочники →
 * Регионы`), previously hardcoded in `shared/data/armeniaRegions.ts`. Name/slug/geometry/label
 * position stay in that static file (fixed reference data, unaffected by this module); this only
 * overlays the one-line teaser shown on the map hover tooltip and the region panel.
 *
 * Fetches both languages via two `GetRegionsClient` calls rather than the admin's single
 * both-locales `GetAll`, to stay inside the `#region ClientEndpoints` boundary the rest of the
 * public site uses (`shared/api/tours.ts`, `shared/api/siteSettings.ts`). The region table is 11
 * rows — two small requests, once per page load, cost nothing.
 */

import { apiFetch } from '@/shared/lib/http'
import type { RegionInfoModel } from '@/shared/types/attours'
import type { RegionSlug } from '@/shared/data/armeniaRegions'

/** `RegionTranslationType.Blurb` on the backend. */
const REGION_TRANSLATION_BLURB = 2

const LANGUAGE_RU = 1
const LANGUAGE_EN = 2

export interface RegionBlurbs {
  ru: Partial<Record<RegionSlug, string>>
  en: Partial<Record<RegionSlug, string>>
}

const EMPTY_BLURBS: RegionBlurbs = { ru: {}, en: {} }

function toBlurbMap(regions: RegionInfoModel[]): Partial<Record<RegionSlug, string>> {
  const result: Partial<Record<RegionSlug, string>> = {}
  for (const region of regions) {
    const blurb = region.translations.find((t) => t.type === REGION_TRANSLATION_BLURB)?.value
    if (blurb) result[region.slug as RegionSlug] = blurb
  }
  return result
}

/** Never throws — a failed fetch just means the map/panel fall back to the static teaser text
 * already baked into `armeniaRegions.ts` (callers merge these on top, not instead of, that data). */
export async function getRegionBlurbs(): Promise<RegionBlurbs> {
  try {
    const [ru, en] = await Promise.all([
      apiFetch<RegionInfoModel[]>(`api/Region/GetRegionsClient?languageCode=${LANGUAGE_RU}`),
      apiFetch<RegionInfoModel[]>(`api/Region/GetRegionsClient?languageCode=${LANGUAGE_EN}`),
    ])
    return { ru: toBlurbMap(ru), en: toBlurbMap(en) }
  } catch {
    return EMPTY_BLURBS
  }
}
