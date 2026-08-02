import { Card, Checkbox } from '@/shared/ui'
import { readLocalized } from '@/features/admin/catalog/lib/catalogMapper'
import type { RegionInfoModel } from '@/shared/types/attours'
import type { TourRegionFormState } from '@/features/admin/types/form'

interface RegionPickerProps {
  regions: RegionInfoModel[]
  selected: TourRegionFormState[]
  onToggle: (regionId: number) => void
}

/**
 * Region multi-select (4.4). A tour can cover several regions (a multi-day route crosses more
 * than one) and covering none is valid — the backend has no "at least one region" rule (D-2) —
 * so this is a plain checkbox set, not a required field. Regions are the fixed 11-region
 * reference list (no search/pagination needed at that size), which is also why this is a wrapped
 * checkbox grid rather than the catalog `SuggestInput` pattern used for route points/expenses/
 * notes — there's nothing to type ahead of.
 */
export function RegionPicker({ regions, selected, onToggle }: RegionPickerProps) {
  const sorted = [...regions].sort((a, b) => a.sortOrder - b.sortOrder)
  const isSelected = (regionId: number) => selected.some((r) => r.regionId === regionId)

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-neutral-700">Регионы</span>
      {sorted.length === 0 ? (
        <p className="text-xs text-neutral-500">Список регионов пуст.</p>
      ) : (
        <Card padding="sm" className="!bg-neutral-50">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            {sorted.map((region) => (
              <Checkbox
                key={region.id}
                label={readLocalized(region.translations).ru || region.slug}
                checked={isSelected(region.id)}
                onChange={() => onToggle(region.id)}
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
