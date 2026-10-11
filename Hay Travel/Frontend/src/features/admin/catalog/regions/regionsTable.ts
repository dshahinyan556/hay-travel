import { updateRegionBlurb } from '@/features/admin/api/adminCatalog'
import { RegionTranslationType } from '@/features/admin/lib/enums'
import type { RegionInfoModel } from '@/shared/types/attours'
import { readLocalizedByType } from '../lib/catalogMapper'
import type { CatalogTableDef } from '../lib/useCatalogTableDraft'

export interface RegionValues {
  teaserRu: string
  teaserEn: string
}

/**
 * Regions are a FIXED set (seeded by a migration, David 2026-08-01): no create, no delete, no
 * reorder — name/slug/order are not editable. Only the teaser ("blurb" — the public map tooltip
 * and region panel) is, through `UpdateBlurb` (since 2026-08-02). No validation: the old card
 * accepted an empty teaser too. Text is compared and saved trimmed (checklist 1.4 — the old card
 * had its own trim-compare; the shared draft now applies the same rule).
 */
export const regionsTable: CatalogTableDef<RegionInfoModel, RegionValues> = {
  toValues: (region) => {
    const blurb = readLocalizedByType(region.translations, RegionTranslationType.Blurb)
    return { teaserRu: blurb.ru, teaserEn: blurb.en }
  },
  validate: () => ({}),
  update: (region, values) => updateRegionBlurb(region.id, values.teaserRu.trim(), values.teaserEn.trim()),
  errorActions: (copy) => copy.regions.actions,
}
