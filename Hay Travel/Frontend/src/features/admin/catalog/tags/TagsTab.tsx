import { TAG_COLOR_HEX } from '@/shared/ui/ProductTag'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminEnumsCopy } from '@/features/admin/lib/adminEnumsCopy'
import { TagColor } from '@/features/admin/lib/enums'
import type { TagInfoModel } from '@/shared/types/attours'
import { catalogCopy } from '../lib/catalogCopy'
import { nameLabel } from '../lib/catalogNameFields'
import { filterDraftRows } from '../lib/filterDraftRows'
import { CatalogGrid } from '../grid/CatalogGrid'
import { CatalogTabFrame, type CatalogTabProps } from '../grid/CatalogTabFrame'
import { ChangedFrame } from '../grid/CatalogCells'
import { textColumn, type CatalogColumn } from '../grid/catalogColumns'
import type { TagValues } from './tagsTable'

type Props = CatalogTabProps<TagInfoModel, TagValues>

const COLOR_OPTIONS: TagColor[] = [TagColor.Gold, TagColor.Wine, TagColor.Success, TagColor.Danger, TagColor.Warning]

interface TagColorPickerProps {
  value: TagColor
  onChange: (color: TagColor) => void
  label: string
  editable: boolean
}

/** The same five-swatch palette the old `TagForm` had, sized for a table cell. */
function TagColorPicker({ value, onChange, label, editable }: TagColorPickerProps) {
  const enums = useCopy(adminEnumsCopy)
  if (!editable) {
    return (
      <span className="flex h-8 items-center gap-2 px-2 text-[13px] text-neutral-700">
        <span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ background: TAG_COLOR_HEX[value] }} />
        {enums.tagColor[value]}
      </span>
    )
  }
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-1.5 py-1">
      {COLOR_OPTIONS.map((option) => {
        const selected = option === value
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={enums.tagColor[option]}
            title={enums.tagColor[option]}
            onClick={() => onChange(option)}
            className={`h-6 w-6 rounded-full ring-2 ring-offset-2 transition-shadow focus:outline-none focus-visible:ring-neutral-900/50 ${
              selected ? 'ring-neutral-900' : 'ring-transparent'
            }`}
            style={{ background: TAG_COLOR_HEX[option] }}
          />
        )
      })}
    </div>
  )
}

/** Product tags catalog — up to 3 per tour (enforced on the tour form's `TagPicker`, not here: this
 * screen manages the tag *definitions*). Purely decorative — discount lives on the tour itself. */
export function TagsTab({ draft, permission, query, locked, showErrors }: Props) {
  const copy = useCopy(catalogCopy)
  const rows = filterDraftRows(draft.rows, query, (row) => `${row.values.nameRu} ${row.values.nameEn}`)
  const filtering = query.trim() !== ''

  const columns: CatalogColumn<TagInfoModel, TagValues>[] = [
    textColumn('nameRu', copy.common.colNameRu),
    textColumn('nameEn', copy.common.colNameEn),
    {
      id: 'color',
      label: copy.tags.colColor,
      className: 'w-52',
      wideOnCard: true,
      render: (ctx) => (
        <ChangedFrame changed={ctx.row.changed.has('color')}>
          <TagColorPicker
            value={ctx.row.values.color}
            onChange={(color) => ctx.setField('color', color)}
            label={copy.tags.colorGroupLabel(ctx.rowLabel)}
            editable={ctx.editable}
          />
        </ChangedFrame>
      ),
    },
  ]

  return (
    <CatalogTabFrame
      isEmpty={draft.rows.length === 0}
      emptyText={copy.tags.empty}
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
          nameLabel(row.values, row.item ? copy.tags.rowFallback(row.item.id) : copy.common.newRowFallback)
        }
        itemLabel={copy.tags.sortableItem}
        tableMinWidth="min-w-[760px]"
      />
    </CatalogTabFrame>
  )
}
