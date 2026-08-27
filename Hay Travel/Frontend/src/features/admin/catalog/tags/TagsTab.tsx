import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Button, buttonClassName, Card, DragHandle, Modal, SortableList, Spinner } from '@/shared/ui'
import type { SortableRowRenderProps } from '@/shared/ui'
import { TAG_COLOR_HEX } from '@/shared/ui/ProductTag'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminCommonCopy } from '@/features/admin/lib/adminCommonCopy'
import { adminEnumsCopy } from '@/features/admin/lib/adminEnumsCopy'
import { SidePanel } from '@/features/admin/ui/SidePanel'
import type { ScreenPermission } from '@/shared/auth'
import { createTag, deleteTag, updateTag } from '@/features/admin/api/adminCatalog'
import type { TagInfoModel } from '@/shared/types/attours'
import { TagType, type TagColor } from '@/features/admin/lib/enums'
import { readLocalized, writeLocalized, writeLocalizedForUpdate } from '@/features/admin/catalog/lib/catalogMapper'
import { catalogCopy } from '@/features/admin/catalog/lib/catalogCopy'
import { catalogErrorMessage } from '@/features/admin/catalog/lib/catalogErrors'
import { catalogRowId, nextSortOrder, useCatalogReorder } from '@/features/admin/catalog/lib/useCatalogReorder'
import { useCatalogSearch } from '@/features/admin/catalog/lib/useCatalogSearch'
import { CatalogSearchInput } from '@/features/admin/catalog/CatalogSearchInput'
import { TagForm, type TagFormValues } from './TagForm'

interface TagsTabProps {
  items: TagInfoModel[]
  /** The four flags of this tab's own permission key, resolved once by `CatalogPage`. */
  permission: ScreenPermission
  onMutated: () => void
}

type PanelState = { mode: 'create' } | { mode: 'edit'; item: TagInfoModel } | null

/** Product tags catalog — up to 3 per tour (enforced when assigning, on the tour form's
 * `TagPicker`, not here: this screen manages the tag *definitions*, not which tour has which).
 * Purely decorative — discount lives on the tour itself (Фаза 3/7), not on a tag. Same
 * CRUD/drag-reorder shell as `ExpenseTemplatesTab`. */
export function TagsTab({ items, permission, onMutated }: TagsTabProps) {
  const copy = useCopy(catalogCopy)
  const common = useCopy(adminCommonCopy)
  const enums = useCopy(adminEnumsCopy)
  const [panel, setPanel] = useState<PanelState>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<TagInfoModel | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const cancelDeleteRef = useRef<HTMLButtonElement>(null)
  const order = useCatalogReorder({
    items,
    update: updateTag,
    onMutated,
    errorAction: copy.tags.actions.reorder,
  })
  const search = useCatalogSearch(order.rows, (item) => {
    const name = readLocalized(item.translations)
    return `${name.ru} ${name.en}`
  })

  async function handleSubmit(values: TagFormValues) {
    setIsSubmitting(true)
    setFormError(null)
    try {
      if (panel?.mode === 'edit') {
        await updateTag({
          id: panel.item.id,
          type: TagType.Regular,
          color: values.color,
          // Position is owned by drag-and-drop now — keep whatever the row already has.
          sortOrder: panel.item.sortOrder,
          translations: writeLocalizedForUpdate(values.name),
        })
      } else {
        await createTag({
          type: TagType.Regular,
          color: values.color,
          sortOrder: nextSortOrder(items),
          translations: writeLocalized(values.name),
        })
      }
      setPanel(null)
      onMutated()
    } catch (err) {
      setFormError(
        catalogErrorMessage(copy, err, panel?.mode === 'edit' ? copy.tags.actions.save : copy.tags.actions.add),
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
      await deleteTag(confirmTarget.id)
      setConfirmTarget(null)
      onMutated()
    } catch (err) {
      setListError(catalogErrorMessage(copy, err, copy.tags.actions.delete))
    } finally {
      setPendingDeleteId(null)
    }
  }

  function renderRow(item: TagInfoModel, sortable?: SortableRowRenderProps) {
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
              label={copy.common.dragToReorder(name || copy.tags.rowFallback(item.id))}
              {...sortable.attributes}
              {...sortable.listeners}
            />
          )}
        </td>
        <td className="px-3 py-2.5">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: TAG_COLOR_HEX[item.color] }}
              title={enums.tagColor[item.color as TagColor]}
            />
            <span className="font-medium text-neutral-900">
              {name || <span className="text-neutral-400">{copy.common.emptyValue}</span>}
            </span>
          </span>
        </td>
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
        <CatalogSearchInput
          value={search.query}
          onChange={search.setQuery}
          placeholder={copy.common.searchByName}
        />
        {permission.canCreate && (
          <Button onClick={() => setPanel({ mode: 'create' })}>{copy.tags.addButton}</Button>
        )}
      </div>

      {(listError ?? order.error) && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {listError ?? order.error}
        </div>
      )}

      {items.length === 0 ? (
        <Card className="text-center text-sm text-neutral-500">{copy.tags.empty}</Card>
      ) : search.isFiltering && search.filtered.length === 0 ? (
        <Card className="text-center text-sm text-neutral-500">
          {copy.common.nothingFoundFor(search.query.trim())}
        </Card>
      ) : (
        <Card padding="sm" className="overflow-x-auto">
          {search.isFiltering && (
            <p className="px-1 pb-2 text-xs text-neutral-400">{copy.common.reorderDisabledBySearch}</p>
          )}
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <th className="w-10 px-2 py-2.5">
                  <span className="sr-only">{copy.common.colOrder}</span>
                </th>
                <th className="px-3 py-2.5">{copy.common.colName}</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {search.isFiltering ? (
                search.filtered.map((item) => renderRow(item))
              ) : (
                <SortableList
                  items={order.rows}
                  getId={catalogRowId}
                  onReorder={order.reorder}
                  itemLabel={copy.tags.sortableItem}
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
        title={panel?.mode === 'edit' ? copy.tags.panelEdit : copy.tags.panelCreate}
      >
        <TagForm
          key={panel?.mode === 'edit' ? panel.item.id : 'create'}
          item={panel?.mode === 'edit' ? panel.item : null}
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
        title={copy.tags.deleteTitle}
        initialFocusRef={cancelDeleteRef}
      >
        <p className="text-sm text-neutral-600">
          {confirmTarget && (
            <>
              {copy.tags.deleteBefore}
              <span className="font-semibold text-neutral-900">{readLocalized(confirmTarget.translations).ru}</span>
              {copy.tags.deleteAfter}
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
