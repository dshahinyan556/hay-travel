import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Button, buttonClassName, Card, DragHandle, Modal, SortableList, Spinner } from '@/shared/ui'
import type { SortableRowRenderProps } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminCommonCopy } from '@/features/admin/lib/adminCommonCopy'
import { SidePanel } from '@/features/admin/ui/SidePanel'
import type { ScreenPermission } from '@/shared/auth'
import {
  createTourNoteTemplate,
  deleteTourNoteTemplate,
  updateTourNoteTemplate,
} from '@/features/admin/api/adminCatalog'
import { TourNoteType } from '@/features/admin/lib/enums'
import type { TourNoteTemplateInfoModel } from '@/shared/types/attours'
import { readLocalized, writeLocalized, writeLocalizedForUpdate } from '@/features/admin/catalog/lib/catalogMapper'
import { catalogCopy, type CatalogCopy } from '@/features/admin/catalog/lib/catalogCopy'
import { catalogErrorMessage } from '@/features/admin/catalog/lib/catalogErrors'
import { catalogRowId, nextSortOrder, useCatalogReorder } from '@/features/admin/catalog/lib/useCatalogReorder'
import { useCatalogSearch } from '@/features/admin/catalog/lib/useCatalogSearch'
import { CatalogSearchInput } from '@/features/admin/catalog/CatalogSearchInput'
import { NoteTemplateForm, type NoteTemplateFormValues } from './NoteTemplateForm'

interface NoteTemplatesTabProps {
  items: TourNoteTemplateInfoModel[]
  /** The four flags of this tab's own permission key, resolved once by `CatalogPage`. */
  permission: ScreenPermission
  onMutated: () => void
}

type PanelState = { mode: 'create' } | { mode: 'edit'; item: TourNoteTemplateInfoModel } | null
type TypeFilter = 'all' | TourNoteType

/** An unknown `type` off the wire falls back to the first member's caption, as before. */
const typeLabel = (copy: CatalogCopy, type: number) =>
  copy.noteTemplates.typeLabels[type] ?? copy.noteTemplates.typeLabels[TourNoteType.OrganizationalDetail]

/** Short captions — five pills have to fit a phone; the full ones live in the table's `Тип` column. */
const typeFilterOptions = (copy: CatalogCopy): { value: TypeFilter; label: string }[] => [
  { value: 'all', label: copy.noteTemplates.filterAll },
  { value: TourNoteType.OrganizationalDetail, label: copy.noteTemplates.filterOrganizational },
  { value: TourNoteType.Restriction, label: copy.noteTemplates.filterRestriction },
  { value: TourNoteType.Included, label: copy.noteTemplates.filterIncluded },
  { value: TourNoteType.NotIncluded, label: copy.noteTemplates.filterNotIncluded },
]

/**
 * Both note types share ONE flat list here, and so does `sortOrder`. That is deliberate:
 * `TourNoteTemplate` has only a plain (non-unique) index on `Type` and no `(Type, SortOrder)`
 * constraint (`TourNoteTemplateConfiguration.cs`), so nothing on the backend expects positions
 * to restart per type. Dragging renumbers the whole table `0..n-1`; the tour form, which filters
 * templates by type, still sees each type's rows in exactly the order shown here, because
 * filtering a sorted list preserves its order.
 */
export function NoteTemplatesTab({ items, permission, onMutated }: NoteTemplatesTabProps) {
  const copy = useCopy(catalogCopy)
  const common = useCopy(adminCommonCopy)
  const [panel, setPanel] = useState<PanelState>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<TourNoteTemplateInfoModel | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const cancelDeleteRef = useRef<HTMLButtonElement>(null)
  const order = useCatalogReorder({
    items,
    update: updateTourNoteTemplate,
    onMutated,
    errorAction: copy.noteTemplates.actions.reorder,
  })
  // Type is filtered first (a separate control from the search box below), then the name search
  // narrows whatever the type filter left — the two compose instead of fighting over one field.
  const typeFiltered = typeFilter === 'all' ? order.rows : order.rows.filter((item) => item.type === typeFilter)
  const search = useCatalogSearch(typeFiltered, (item) => {
    const name = readLocalized(item.translations)
    return `${name.ru} ${name.en}`
  })
  // Either control narrowing the list disables drag-and-drop — same reason as a text query (see
  // `useCatalogSearch`): drag indices address the full row list, and a filtered subset would
  // reassign the wrong `sortOrder` to the wrong row.
  const isNarrowing = typeFilter !== 'all' || search.isFiltering

  async function handleSubmit(values: NoteTemplateFormValues) {
    setIsSubmitting(true)
    setFormError(null)
    const type = Number(values.type)
    try {
      if (panel?.mode === 'edit') {
        await updateTourNoteTemplate({
          id: panel.item.id,
          type,
          // Position is owned by drag-and-drop now — keep whatever the row already has.
          sortOrder: panel.item.sortOrder,
          translations: writeLocalizedForUpdate(values.name),
        })
      } else {
        await createTourNoteTemplate({
          type,
          sortOrder: nextSortOrder(items),
          translations: writeLocalized(values.name),
        })
      }
      setPanel(null)
      onMutated()
    } catch (err) {
      setFormError(
        catalogErrorMessage(
          copy,
          err,
          panel?.mode === 'edit' ? copy.noteTemplates.actions.save : copy.noteTemplates.actions.add,
        ),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function confirmDelete() {
    if (confirmTarget === null) return
    setListError(null)
    setPendingDeleteId(confirmTarget.id)
    try {
      await deleteTourNoteTemplate(confirmTarget.id)
      setConfirmTarget(null)
      onMutated()
    } catch (err) {
      setListError(catalogErrorMessage(copy, err, copy.noteTemplates.actions.delete))
    } finally {
      setPendingDeleteId(null)
    }
  }

  /** Shared row markup. `sortable` is omitted while a search query is active — see `useCatalogSearch`. */
  function renderRow(item: TourNoteTemplateInfoModel, sortable?: SortableRowRenderProps) {
    const name = readLocalized(item.translations).ru
    return (
      <tr
        key={sortable ? undefined : item.id}
        ref={sortable?.setNodeRef}
        style={sortable?.style as CSSProperties | undefined}
        className={`border-b border-neutral-100 last:border-0 ${
          sortable?.isDragging ? 'relative z-10 bg-neutral-100/60' : ''
        }`}
      >
        <td className="w-10 px-2 py-2.5">
          {sortable && (
            <DragHandle
              ref={sortable.setActivatorNodeRef}
              // Reordering PERSISTS server-side — it is an edit, not a view preference.
              disabled={order.isSaving || !permission.canUpdate}
              label={copy.common.dragToReorder(name || copy.noteTemplates.rowFallback(item.id))}
              {...sortable.attributes}
              {...sortable.listeners}
            />
          )}
        </td>
        <td className="px-3 py-2.5 font-medium text-neutral-900">
          {name || <span className="text-neutral-400">{copy.common.emptyValue}</span>}
        </td>
        <td className="px-3 py-2.5 text-neutral-500">{typeLabel(copy, item.type)}</td>
        <td className="px-3 py-2.5">
          <div className="flex justify-end gap-1.5">
            {permission.canUpdate && (
              <button
                type="button"
                onClick={() => setPanel({ mode: 'edit', item })}
                className="rounded-lg px-2.5 py-1 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
              >
                {common.edit}
              </button>
            )}
            {permission.canDelete && (
              <button
                type="button"
                onClick={() => setConfirmTarget(item)}
                disabled={pendingDeleteId === item.id}
                className="rounded-lg px-2.5 py-1 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:pointer-events-none disabled:opacity-50"
              >
                {common.delete}
              </button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <CatalogSearchInput
            value={search.query}
            onChange={search.setQuery}
            placeholder={copy.common.searchByName}
          />
          {/* `max-w-full overflow-x-auto` (same pattern as `shared/ui/Tabs`): five pills don't fit
              a 375px viewport, so the group scrolls horizontally in place instead of either
              wrapping into a multi-row pill cluster or bleeding past the edge of the screen. */}
          <div
            role="radiogroup"
            aria-label={copy.noteTemplates.typeFilterLabel}
            className="no-scrollbar inline-flex max-w-full overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-100 p-1"
          >
            {typeFilterOptions(copy).map((option) => {
              const selected = option.value === typeFilter
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTypeFilter(option.value)}
                  className={`shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30 ${
                    selected ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600 hover:text-neutral-800'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
        {permission.canCreate && (
          <Button onClick={() => setPanel({ mode: 'create' })}>{copy.noteTemplates.addButton}</Button>
        )}
      </div>

      {(listError ?? order.error) && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {listError ?? order.error}
        </div>
      )}

      {items.length === 0 ? (
        <Card className="text-center text-sm text-neutral-500">{copy.noteTemplates.empty}</Card>
      ) : isNarrowing && search.filtered.length === 0 ? (
        <Card className="text-center text-sm text-neutral-500">
          {search.isFiltering
            ? copy.common.nothingFoundFor(search.query.trim())
            : copy.noteTemplates.emptyOfType}
        </Card>
      ) : (
        <Card padding="sm" className="overflow-x-auto">
          {isNarrowing && (
            <p className="px-1 pb-2 text-xs text-neutral-400">{copy.noteTemplates.reorderDisabledByFilter}</p>
          )}
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <th className="w-10 px-2 py-2.5">
                  <span className="sr-only">{copy.common.colOrder}</span>
                </th>
                <th className="px-3 py-2.5">{copy.common.colName}</th>
                <th className="px-3 py-2.5">{copy.noteTemplates.colType}</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {isNarrowing ? (
                search.filtered.map((item) => renderRow(item))
              ) : (
                <SortableList
                  items={order.rows}
                  getId={catalogRowId}
                  onReorder={order.reorder}
                  itemLabel={copy.noteTemplates.sortableItem}
                >
                  {(item, _index, sortable) => renderRow(item, sortable)}
                </SortableList>
              )}
            </tbody>
          </table>
        </Card>
      )}

      <SidePanel
        open={panel !== null}
        onClose={() => setPanel(null)}
        title={panel?.mode === 'edit' ? copy.noteTemplates.panelEdit : copy.noteTemplates.panelCreate}
      >
        <NoteTemplateForm
          key={panel?.mode === 'edit' ? panel.item.id : 'create'}
          item={panel?.mode === 'edit' ? panel.item : null}
          defaultType={typeFilter === 'all' ? TourNoteType.OrganizationalDetail : typeFilter}
          isSubmitting={isSubmitting}
          error={formError}
          onSubmit={handleSubmit}
          onCancel={() => setPanel(null)}
        />
      </SidePanel>

      <Modal
        open={confirmTarget !== null}
        onClose={() => {
          if (pendingDeleteId === null) setConfirmTarget(null)
        }}
        title={copy.noteTemplates.deleteTitle}
        initialFocusRef={cancelDeleteRef}
      >
        <p className="text-sm text-neutral-600">
          {confirmTarget && (
            <>
              {copy.noteTemplates.deleteBefore}
              <span className="font-semibold text-neutral-900">{readLocalized(confirmTarget.translations).ru}</span>
              {copy.noteTemplates.deleteAfter}
            </>
          )}
        </p>
        <div className="mt-5 flex justify-end gap-2.5">
          <button
            ref={cancelDeleteRef}
            type="button"
            onClick={() => setConfirmTarget(null)}
            disabled={pendingDeleteId !== null}
            className={`${buttonClassName('ghost', 'md')} disabled:pointer-events-none disabled:opacity-50`}
          >
            {common.cancel}
          </button>
          <Button type="button" variant="danger" onClick={confirmDelete} disabled={pendingDeleteId !== null} className="min-w-28">
            {pendingDeleteId !== null ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size="sm" />
                {copy.common.deletingButton}
              </span>
            ) : (
              common.delete
            )}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
