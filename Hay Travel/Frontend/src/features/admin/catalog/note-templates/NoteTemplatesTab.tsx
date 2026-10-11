import { useCopy } from '@/shared/i18n/defineCopy'
import { TourNoteType } from '@/features/admin/lib/enums'
import type { TourNoteTemplateInfoModel } from '@/shared/types/attours'
import { catalogCopy, type CatalogCopy } from '../lib/catalogCopy'
import { nameLabel } from '../lib/catalogNameFields'
import { filterDraftRows } from '../lib/filterDraftRows'
import { CatalogGrid } from '../grid/CatalogGrid'
import { CatalogTabFrame, type CatalogTabProps } from '../grid/CatalogTabFrame'
import { selectColumn, textColumn, type CatalogColumn } from '../grid/catalogColumns'
import { NOTE_TYPES, type NoteTemplateValues, type NoteTypeFilter } from './noteTemplatesTable'

interface Props extends CatalogTabProps<TourNoteTemplateInfoModel, NoteTemplateValues> {
  /** Owned by `CatalogPage`: «Добавить» pre-selects the filtered type for a new note. */
  typeFilter: NoteTypeFilter
  onTypeFilterChange: (filter: NoteTypeFilter) => void
}

/** Short captions — five pills have to fit a phone; the full ones live in the `Тип` column. */
const typeFilterOptions = (copy: CatalogCopy): { value: NoteTypeFilter; label: string }[] => [
  { value: 'all', label: copy.noteTemplates.filterAll },
  { value: TourNoteType.OrganizationalDetail, label: copy.noteTemplates.filterOrganizational },
  { value: TourNoteType.Restriction, label: copy.noteTemplates.filterRestriction },
  { value: TourNoteType.Included, label: copy.noteTemplates.filterIncluded },
  { value: TourNoteType.NotIncluded, label: copy.noteTemplates.filterNotIncluded },
]

export function NoteTemplatesTab({ draft, permission, query, locked, showErrors, typeFilter, onTypeFilterChange }: Props) {
  const copy = useCopy(catalogCopy)
  // Type first (its own control), then the name search narrows whatever the type left.
  const typed =
    typeFilter === 'all'
      ? draft.rows
      : draft.rows.filter((row) => row.status === 'new' || Number(row.values.type) === typeFilter)
  const rows = filterDraftRows(typed, query, (row) => `${row.values.nameRu} ${row.values.nameEn}`)
  const searching = query.trim() !== ''
  // Either control narrowing the list disables drag — drag indices address the FULL row list.
  const narrowing = typeFilter !== 'all' || searching

  const typeOptions = NOTE_TYPES.map((type) => ({ value: String(type), label: copy.noteTemplates.typeLabels[type] }))
  const columns: CatalogColumn<TourNoteTemplateInfoModel, NoteTemplateValues>[] = [
    selectColumn('type', copy.noteTemplates.colType, typeOptions, { className: 'w-60', wideOnCard: true }),
    textColumn('nameRu', copy.common.colNameRu),
    textColumn('nameEn', copy.common.colNameEn),
  ]

  const filterBar = (
    // `max-w-full overflow-x-auto` (same pattern as `shared/ui/Tabs`): five pills don't fit a
    // 375px viewport, so the group scrolls in place instead of wrapping or bleeding off-screen.
    <div
      role="radiogroup"
      aria-label={copy.noteTemplates.typeFilterLabel}
      className="no-scrollbar inline-flex max-w-full self-start overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-100 p-1"
    >
      {typeFilterOptions(copy).map((option) => {
        const selected = option.value === typeFilter
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onTypeFilterChange(option.value)}
            className={`shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30 ${
              selected ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600 hover:text-neutral-800'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )

  return (
    <CatalogTabFrame
      isEmpty={draft.rows.length === 0}
      emptyText={copy.noteTemplates.empty}
      nothingFoundText={
        rows.length === 0 ? (searching ? copy.common.nothingFoundFor(query.trim()) : copy.noteTemplates.emptyOfType) : null
      }
      notice={narrowing ? copy.noteTemplates.reorderDisabledByFilter : null}
      toolbar={draft.rows.length > 0 ? filterBar : undefined}
    >
      <CatalogGrid
        draft={draft}
        rows={rows}
        columns={columns}
        permission={permission}
        locked={locked}
        showErrors={showErrors}
        reorderable
        reorderEnabled={!narrowing}
        selectable
        rowLabel={(row) =>
          nameLabel(row.values, row.item ? copy.noteTemplates.rowFallback(row.item.id) : copy.common.newRowFallback)
        }
        itemLabel={copy.noteTemplates.sortableItem}
        tableMinWidth="min-w-[820px]"
      />
    </CatalogTabFrame>
  )
}
