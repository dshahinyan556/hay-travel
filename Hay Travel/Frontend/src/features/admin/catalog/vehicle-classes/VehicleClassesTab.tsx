import { useCopy } from '@/shared/i18n/defineCopy'
import type { VehicleClassInfoModel } from '@/shared/types/attours'
import { catalogCopy } from '../lib/catalogCopy'
import { nameLabel } from '../lib/catalogNameFields'
import { filterDraftRows } from '../lib/filterDraftRows'
import { CatalogGrid } from '../grid/CatalogGrid'
import { CatalogTabFrame, type CatalogTabProps } from '../grid/CatalogTabFrame'
import { checkboxColumn, textColumn, type CatalogColumn } from '../grid/catalogColumns'
import type { VehicleClassValues } from './vehicleClassesTable'

type Props = CatalogTabProps<VehicleClassInfoModel, VehicleClassValues>

/** Vehicle class DEFINITIONS (not a transfer's per-class prices — those live on the transfer). */
export function VehicleClassesTab({ draft, permission, query, locked, showErrors }: Props) {
  const copy = useCopy(catalogCopy)
  const rows = filterDraftRows(draft.rows, query, (row) => `${row.values.nameRu} ${row.values.nameEn}`)
  const filtering = query.trim() !== ''

  const columns: CatalogColumn<VehicleClassInfoModel, VehicleClassValues>[] = [
    textColumn('nameRu', copy.common.colNameRu),
    textColumn('nameEn', copy.common.colNameEn),
    textColumn('capacity', copy.vehicleClasses.colCapacity, {
      numeric: true,
      help: copy.vehicleClasses.capacityHint,
      className: 'w-32',
    }),
    textColumn('luggageCapacity', copy.vehicleClasses.colLuggage, {
      numeric: true,
      help: copy.vehicleClasses.luggageCapacityHint,
      className: 'w-36',
    }),
    checkboxColumn('isActive', copy.vehicleClasses.colActive, {
      help: copy.vehicleClasses.activeHint,
      className: 'w-28',
    }),
  ]

  return (
    <CatalogTabFrame
      isEmpty={draft.rows.length === 0}
      emptyText={copy.vehicleClasses.empty}
      nothingFoundText={rows.length === 0 ? copy.common.nothingFoundFor(query.trim()) : null}
      notice={filtering ? copy.common.reorderDisabledBySearch : null}
    >
      <CatalogGrid
        draft={draft}
        rows={rows}
        columns={columns}
        permission={permission}
        locked={locked}
        showErrors={showErrors}
        reorderable
        reorderEnabled={!filtering}
        selectable
        rowLabel={(row) =>
          nameLabel(row.values, row.item ? copy.vehicleClasses.rowFallback(row.item.id) : copy.common.newRowFallback)
        }
        itemLabel={copy.vehicleClasses.sortableItem}
        tableMinWidth="min-w-[860px]"
      />
    </CatalogTabFrame>
  )
}
