import { useCopy } from '@/shared/i18n/defineCopy'
import type { ExpenseTemplateInfoModel } from '@/shared/types/attours'
import { catalogCopy } from '../lib/catalogCopy'
import { nameLabel } from '../lib/catalogNameFields'
import { filterDraftRows } from '../lib/filterDraftRows'
import { CatalogGrid } from '../grid/CatalogGrid'
import { CatalogTabFrame, type CatalogTabProps } from '../grid/CatalogTabFrame'
import { textColumn, type CatalogColumn } from '../grid/catalogColumns'
import type { ExpenseTemplateValues } from './expenseTemplatesTable'

type Props = CatalogTabProps<ExpenseTemplateInfoModel, ExpenseTemplateValues>

export function ExpenseTemplatesTab({ draft, permission, query, locked, showErrors }: Props) {
  const copy = useCopy(catalogCopy)
  const rows = filterDraftRows(draft.rows, query, (row) => `${row.values.nameRu} ${row.values.nameEn}`)
  const filtering = query.trim() !== ''

  const columns: CatalogColumn<ExpenseTemplateInfoModel, ExpenseTemplateValues>[] = [
    textColumn('nameRu', copy.common.colNameRu),
    textColumn('nameEn', copy.common.colNameEn),
  ]

  return (
    <CatalogTabFrame
      isEmpty={draft.rows.length === 0}
      emptyText={copy.expenseTemplates.empty}
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
          nameLabel(row.values, row.item ? copy.expenseTemplates.rowFallback(row.item.id) : copy.common.newRowFallback)
        }
        itemLabel={copy.expenseTemplates.sortableItem}
        tableMinWidth="min-w-[640px]"
      />
    </CatalogTabFrame>
  )
}
