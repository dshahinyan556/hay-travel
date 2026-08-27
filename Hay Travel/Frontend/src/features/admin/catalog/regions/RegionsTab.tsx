import { useState } from 'react'
import { Card, Textarea } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import type { RegionInfoModel } from '@/shared/types/attours'
import { adminCommonCopy } from '@/features/admin/lib/adminCommonCopy'
import { RegionTranslationType } from '@/features/admin/lib/enums'
import { readLocalizedByType } from '@/features/admin/catalog/lib/catalogMapper'
import { catalogCopy } from '@/features/admin/catalog/lib/catalogCopy'
import { updateRegionBlurb } from '@/features/admin/api/adminCatalog'
import type { Localized } from '@/features/admin/types/localized'
import { ApiError } from '@/shared/lib/http'

interface RegionsTabProps {
  regions: RegionInfoModel[]
  /** `catalog.regions.Update`. The set of regions is fixed by a seed migration, so View and Update
   * are the only actions this key has at all — without Update the cards are read-only. */
  canUpdate: boolean
  /** Called after a successful blurb save so the parent can revalidate the loader. */
  onMutated: () => void
}

/**
 * Name/slug/order are fixed reference data (seeded by a migration, David 2026-08-01 — no
 * Create/Update/Delete for those). The teaser text ("blurb" — shown on the public map hover
 * tooltip and region panel) IS editable here since 2026-08-02: it used to be hardcoded in
 * `Frontend/src/shared/data/armeniaRegions.ts`, now it round-trips through `UpdateBlurb`.
 */
export function RegionsTab({ regions, canUpdate, onMutated }: RegionsTabProps) {
  const copy = useCopy(catalogCopy)
  const sorted = [...regions].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
        {copy.regions.notice}
      </div>

      <div className="flex flex-col gap-3">
        {sorted.map((region) => (
          <RegionBlurbCard
            key={region.id}
            region={region}
            canUpdate={canUpdate}
            onMutated={onMutated}
          />
        ))}
      </div>
    </div>
  )
}

function RegionBlurbCard({
  region,
  canUpdate,
  onMutated,
}: {
  region: RegionInfoModel
  canUpdate: boolean
  onMutated: () => void
}) {
  const copy = useCopy(catalogCopy)
  const common = useCopy(adminCommonCopy)
  const name = readLocalizedByType(region.translations, RegionTranslationType.Name)
  const savedBlurb = readLocalizedByType(region.translations, RegionTranslationType.Blurb)

  const [draft, setDraft] = useState<Localized>(savedBlurb)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = draft.ru.trim() !== savedBlurb.ru.trim() || draft.en.trim() !== savedBlurb.en.trim()

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await updateRegionBlurb(region.id, draft.ru.trim(), draft.en.trim())
      onMutated()
    } catch (err) {
      setError(
        err instanceof ApiError
          ? copy.regions.saveServerError(err.status)
          : copy.regions.saveNetworkError,
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card padding="sm" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="font-semibold text-neutral-900">{name.ru || copy.common.emptyValue}</span>
          <span className="ml-2 text-sm text-neutral-500">{name.en}</span>
        </div>
        <span className="text-xs text-neutral-400">
          {region.slug} · {copy.regions.tourCount(region.tourCount)}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">{copy.regions.teaserRu}</span>
          <Textarea
            rows={2}
            disabled={!canUpdate}
            value={draft.ru}
            onChange={(e) => setDraft((prev) => ({ ...prev, ru: e.target.value }))}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">{copy.regions.teaserEn}</span>
          <Textarea
            rows={2}
            disabled={!canUpdate}
            value={draft.en}
            onChange={(e) => setDraft((prev) => ({ ...prev, en: e.target.value }))}
          />
        </label>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving || !canUpdate}
          className="inline-flex items-center rounded-lg bg-neutral-950 px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? copy.common.savingButton : common.save}
        </button>
      </div>
    </Card>
  )
}
