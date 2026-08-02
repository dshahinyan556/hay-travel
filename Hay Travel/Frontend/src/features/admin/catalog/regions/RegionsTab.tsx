import { useState } from 'react'
import { Card, Textarea } from '@/shared/ui'
import type { RegionInfoModel } from '@/shared/types/attours'
import { RegionTranslationType } from '@/features/admin/lib/enums'
import { readLocalizedByType } from '@/features/admin/catalog/lib/catalogMapper'
import { updateRegionBlurb } from '@/features/admin/api/adminCatalog'
import type { Localized } from '@/features/admin/types/localized'
import { ApiError } from '@/shared/lib/http'

interface RegionsTabProps {
  regions: RegionInfoModel[]
  /** Called after a successful blurb save so the parent can revalidate the loader. */
  onMutated: () => void
}

/**
 * Name/slug/order are fixed reference data (seeded by a migration, David 2026-08-01 — no
 * Create/Update/Delete for those). The teaser text ("blurb" — shown on the public map hover
 * tooltip and region panel) IS editable here since 2026-08-02: it used to be hardcoded in
 * `Frontend/src/shared/data/armeniaRegions.ts`, now it round-trips through `UpdateBlurb`.
 */
export function RegionsTab({ regions, onMutated }: RegionsTabProps) {
  const sorted = [...regions].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
        Список регионов зафиксирован на бэкенде — добавление, переименование и удаление здесь
        недоступны. Редактируется только тизер (короткое описание под названием на карте).
      </div>

      <div className="flex flex-col gap-3">
        {sorted.map((region) => (
          <RegionBlurbCard key={region.id} region={region} onMutated={onMutated} />
        ))}
      </div>
    </div>
  )
}

function RegionBlurbCard({
  region,
  onMutated,
}: {
  region: RegionInfoModel
  onMutated: () => void
}) {
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
          ? `Не удалось сохранить: сервер вернул ошибку (${err.status}).`
          : 'Не удалось сохранить: проверьте соединение и попробуйте ещё раз.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card padding="sm" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="font-semibold text-neutral-900">{name.ru || '—'}</span>
          <span className="ml-2 text-sm text-neutral-500">{name.en}</span>
        </div>
        <span className="text-xs text-neutral-400">
          {region.slug} · {region.tourCount} тур(ов)
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">Тизер (RU)</span>
          <Textarea
            rows={2}
            value={draft.ru}
            onChange={(e) => setDraft((prev) => ({ ...prev, ru: e.target.value }))}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">Тизер (EN)</span>
          <Textarea
            rows={2}
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
          disabled={!dirty || saving}
          className="inline-flex items-center rounded-lg bg-brand-600 px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>
    </Card>
  )
}
