/**
 * Admin Site Settings API — one function per backend endpoint, all routed through `apiFetch`.
 *
 * Backend route base is `api/SiteSettings`. The public read (`GetPublic`, one locale, public
 * keys only) is deliberately NOT here: it belongs to the public site and will get its own
 * module under `shared/api/` when stage 5.2 needs it.
 */

import { apiFetch } from '@/shared/lib/http'
import type { SiteSettingInfoModel, SiteSettingUpdateModel } from '@/shared/types/attours'

/**
 * GET the full settings catalog with the stored values of both languages.
 *
 * There is no separate `Init` endpoint — this one already plays that role: a key that has no
 * DB row yet comes back with `id: 0` and the catalog default.
 */
export function getAllSiteSettings(): Promise<SiteSettingInfoModel[]> {
  return apiFetch<SiteSettingInfoModel[]>('api/SiteSettings/GetAll')
}

/**
 * PUT a batch of settings. Upsert is keyed by `key`, so the payload may be partial — send only
 * what actually changed. Returns the same merged list `GetAll` returns, which the form uses as
 * its new baseline (no follow-up GET needed).
 *
 * An unknown key answers 400 with error code `SiteSettingKeyUnknown` (2005).
 */
export function updateSiteSettings(
  models: SiteSettingUpdateModel[],
): Promise<SiteSettingInfoModel[]> {
  return apiFetch<SiteSettingInfoModel[]>('api/SiteSettings/Update', {
    method: 'PUT',
    body: JSON.stringify(models),
  })
}
