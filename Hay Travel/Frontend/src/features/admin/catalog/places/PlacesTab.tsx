import { useMemo } from 'react'
import { useCopy } from '@/shared/i18n/defineCopy'
import type { PlaceInfoModel, RegionInfoModel } from '@/shared/types/attours'
import { catalogCopy } from '../lib/catalogCopy'
import { readLocalized } from '../lib/catalogMapper'
import { nameLabel } from '../lib/catalogNameFields'
import { filterDraftRows } from '../lib/filterDraftRows'
import { CatalogGrid } from '../grid/CatalogGrid'
import { CatalogTabFrame, type CatalogTabProps } from '../grid/CatalogTabFrame'
import { CellText } from '../grid/CatalogCells'
import { selectColumn, textColumn, type CatalogColumn } from '../grid/catalogColumns'
import { PlaceDetail } from './PlaceDetail'
import type { PlaceValues } from './placesTable'

interface Props extends CatalogTabProps<PlaceInfoModel, PlaceValues> {
  /** `null` when the role may edit points but not read `catalog.regions` — the region picker is
   * then disabled and its column explains why behind «?», instead of a silently empty dropdown
   * (frontend roles architecture §0.8: an unexplained empty list hides a misconfiguration). */
  regions: RegionInfoModel[] | null
}

export function PlacesTab({ draft, permission, query, locked, showErrors, regions }: Props) {
  const copy = useCopy(catalogCopy)
  const regionOptions = useMemo(
    () =>
      (regions ?? []).map((region) => ({
        value: String(region.id),
        label: readLocalized(region.translations).ru || region.slug,
      })),
    [regions],
  )
  const regionName = (regionId: string) => regionOptions.find((option) => option.value === regionId)?.label ?? ''

  const rows = filterDraftRows(draft.rows, query, (row) => {
    const { nameRu, nameEn, slug, regionId } = row.values
    return `${nameRu} ${nameEn} ${slug} ${regionName(regionId)}`
  })
  const filtering = query.trim() !== ''
  const regionsUnavailable = regions === null

  const columns: CatalogColumn<PlaceInfoModel, PlaceValues>[] = [
    textColumn('nameRu', copy.common.colNameRu),
    textColumn('nameEn', copy.common.colNameEn),
    textColumn('slug', copy.places.colSlug, { help: copy.places.slugHint }),
    selectColumn('regionId', copy.places.colRegion, regionOptions, {
      className: 'w-44',
      placeholder: regionsUnavailable ? copy.common.emptyValue : copy.places.regionPlaceholder,
      disabled: regionsUnavailable,
      help: regionsUnavailable ? copy.places.regionsUnavailableHint : undefined,
    }),
    {
      id: 'photos',
      label: copy.places.colPhotos,
      className: 'w-20',
      align: 'end',
      render: (ctx) => (
        <div className={ctx.row.changed.has('images') ? 'rounded-[7px] bg-blue-50' : ''}>
          <CellText value={String(ctx.row.values.images.length)} align="end" layout={ctx.layout} />
        </div>
      ),
    },
  ]

  return (
    <CatalogTabFrame
      isEmpty={draft.rows.length === 0}
      emptyText={copy.places.empty}
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
        rowLabel={(row) => nameLabel(row.values, row.values.slug.trim() || copy.common.newRowFallback)}
        itemLabel={copy.places.sortableItem}
        renderDetail={(ctx) => <PlaceDetail ctx={ctx} />}
        tableMinWidth="min-w-[980px]"
      />
    </CatalogTabFrame>
  )
}
