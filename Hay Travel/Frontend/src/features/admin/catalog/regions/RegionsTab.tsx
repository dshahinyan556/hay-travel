import { Field, Textarea } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { RegionTranslationType } from '@/features/admin/lib/enums'
import type { RegionInfoModel } from '@/shared/types/attours'
import { catalogCopy } from '../lib/catalogCopy'
import { readLocalizedByType } from '../lib/catalogMapper'
import { filterDraftRows } from '../lib/filterDraftRows'
import { CatalogGrid } from '../grid/CatalogGrid'
import { CatalogTabFrame, type CatalogTabProps } from '../grid/CatalogTabFrame'
import { CellText } from '../grid/CatalogCells'
import { textColumn, type CatalogCellContext, type CatalogColumn } from '../grid/catalogColumns'
import type { RegionValues } from './regionsTable'

type Props = CatalogTabProps<RegionInfoModel, RegionValues>
type Ctx = CatalogCellContext<RegionInfoModel, RegionValues>

const regionName = (region: RegionInfoModel | null) =>
  region ? readLocalizedByType(region.translations, RegionTranslationType.Name) : { ru: '', en: '' }

/** Teasers are short (one line on the map), so they are edited right in the cell; the detail row
 * gives the same two fields as multi-line `Textarea`s for a longer text. */
function RegionTeaserDetail({ ctx }: { ctx: Ctx }) {
  const copy = useCopy(catalogCopy)
  const field = (key: 'teaserRu' | 'teaserEn', label: string) => (
    <Field label={label} htmlFor={`${ctx.row.key}-${key}`}>
      <Textarea
        id={`${ctx.row.key}-${key}`}
        rows={2}
        disabled={!ctx.editable}
        value={ctx.row.values[key]}
        onChange={(e) => ctx.setField(key, e.target.value)}
        // A ring, not a background: `Textarea` already sets `bg-white`, and two background
        // utilities on one element resolve by stylesheet order, not by class order.
        className={ctx.row.changed.has(key) ? 'ring-2 ring-blue-300' : ''}
      />
    </Field>
  )
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {field('teaserRu', copy.regions.teaserRu)}
      {field('teaserEn', copy.regions.teaserEn)}
    </div>
  )
}

export function RegionsTab({ draft, permission, query, locked, showErrors }: Props) {
  const copy = useCopy(catalogCopy)
  const rows = filterDraftRows(draft.rows, query, (row) => {
    const name = regionName(row.item)
    return `${name.ru} ${name.en} ${row.item?.slug ?? ''}`
  })

  const columns: CatalogColumn<RegionInfoModel, RegionValues>[] = [
    {
      id: 'name',
      label: copy.regions.colName,
      help: copy.regions.notice,
      className: 'w-48',
      wideOnCard: true,
      render: (ctx) => {
        const name = regionName(ctx.row.item)
        return <CellText value={[name.ru, name.en].filter(Boolean).join(' · ')} layout={ctx.layout} />
      },
    },
    {
      id: 'tours',
      label: copy.regions.colTours,
      className: 'w-24',
      align: 'end',
      render: (ctx) => <CellText value={String(ctx.row.item?.tourCount ?? 0)} align="end" layout={ctx.layout} />,
    },
    textColumn('teaserRu', copy.regions.teaserRu, { wideOnCard: true }),
    textColumn('teaserEn', copy.regions.teaserEn, { wideOnCard: true }),
  ]

  return (
    <CatalogTabFrame
      isEmpty={draft.rows.length === 0}
      emptyText={copy.regions.empty}
      nothingFoundText={rows.length === 0 ? copy.common.nothingFoundFor(query.trim()) : null}
    >
      <CatalogGrid
        draft={draft}
        rows={rows}
        columns={columns}
        permission={permission}
        locked={locked}
        showErrors={showErrors}
        reorderable={false}
        reorderEnabled={false}
        selectable={false}
        rowLabel={(row) => regionName(row.item).ru || row.item?.slug || copy.common.emptyValue}
        itemLabel={copy.common.tabs.regions}
        renderDetail={(ctx) => <RegionTeaserDetail ctx={ctx} />}
        tableMinWidth="min-w-[860px]"
      />
    </CatalogTabFrame>
  )
}
