import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Button, buttonClassName, Card, DragHandle, Modal, SortableList, Spinner } from '@/shared/ui'
import type { SortableRowRenderProps } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminCommonCopy } from '@/features/admin/lib/adminCommonCopy'
import { SidePanel } from '@/features/admin/ui/SidePanel'
import type { ScreenPermission } from '@/shared/auth'
import {
  createVehicleClass,
  deleteVehicleClass,
  updateVehicleClass,
} from '@/features/admin/api/adminCatalog'
import type { VehicleClassInfoModel } from '@/shared/types/attours'
import { readLocalized, writeLocalized, writeLocalizedForUpdate } from '@/features/admin/catalog/lib/catalogMapper'
import { catalogCopy } from '@/features/admin/catalog/lib/catalogCopy'
import { catalogErrorMessage } from '@/features/admin/catalog/lib/catalogErrors'
import { catalogRowId, nextSortOrder, useCatalogReorder } from '@/features/admin/catalog/lib/useCatalogReorder'
import { useCatalogSearch } from '@/features/admin/catalog/lib/useCatalogSearch'
import { CatalogSearchInput } from '@/features/admin/catalog/CatalogSearchInput'
import { VehicleClassForm, type VehicleClassFormValues } from './VehicleClassForm'

interface VehicleClassesTabProps {
  items: VehicleClassInfoModel[]
  /** The four flags of this tab's own permission key, resolved once by `CatalogPage`. */
  permission: ScreenPermission
  onMutated: () => void
}

type PanelState = { mode: 'create' } | { mode: 'edit'; item: VehicleClassInfoModel } | null

/** Vehicle class catalog (batch 2026-08-29, decision 0.7) — pricing tier for predefined
 * transfers: each class carries a passenger capacity, a luggage limit (in "units": a medium
 * suitcase = 3, a large one = 5) and an `isActive` flag that hides it from selection without
 * deleting it (still referenced by past transfer prices/orders). Same CRUD/drag-reorder shell as
 * `TagsTab`/`ExpenseTemplatesTab` — this screen manages the class DEFINITIONS, not a transfer's
 * per-class prices (that lives on the transfer's own form, Фаза 3). */
export function VehicleClassesTab({ items, permission, onMutated }: VehicleClassesTabProps) {
  const copy = useCopy(catalogCopy)
  const common = useCopy(adminCommonCopy)
  const [panel, setPanel] = useState<PanelState>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<VehicleClassInfoModel | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const cancelDeleteRef = useRef<HTMLButtonElement>(null)
  const order = useCatalogReorder({
    items,
    update: updateVehicleClass,
    onMutated,
    errorAction: copy.vehicleClasses.actions.reorder,
  })
  const search = useCatalogSearch(order.rows, (item) => {
    const name = readLocalized(item.translations)
    return `${name.ru} ${name.en}`
  })

  async function handleSubmit(values: VehicleClassFormValues) {
    setIsSubmitting(true)
    setFormError(null)
    try {
      if (panel?.mode === 'edit') {
        await updateVehicleClass({
          id: panel.item.id,
          capacity: values.capacity,
          luggageCapacity: values.luggageCapacity,
          isActive: values.isActive,
          // Position is owned by drag-and-drop now — keep whatever the row already has.
          sortOrder: panel.item.sortOrder,
          translations: writeLocalizedForUpdate(values.name),
        })
      } else {
        await createVehicleClass({
          capacity: values.capacity,
          luggageCapacity: values.luggageCapacity,
          isActive: values.isActive,
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
          panel?.mode === 'edit' ? copy.vehicleClasses.actions.save : copy.vehicleClasses.actions.add,
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
      await deleteVehicleClass(confirmTarget.id)
      setConfirmTarget(null)
      onMutated()
    } catch (err) {
      setListError(
        catalogErrorMessage(
          copy,
          err,
          copy.vehicleClasses.actions.delete,
          copy.vehicleClasses.deleteInUseError,
        ),
      )
    } finally {
      setPendingDeleteId(null)
    }
  }

  function renderRow(item: VehicleClassInfoModel, sortable?: SortableRowRenderProps) {
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
              label={copy.common.dragToReorder(name || copy.vehicleClasses.rowFallback(item.id))}
              {...sortable.attributes}
              {...sortable.listeners}
            />
          )}
        </td>
        <td className="px-3 py-2.5 font-medium text-neutral-900">
          {name || <span className="text-neutral-400">{copy.common.emptyValue}</span>}
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums text-neutral-700">{item.capacity}</td>
        <td className="px-3 py-2.5 text-right tabular-nums text-neutral-700">{item.luggageCapacity}</td>
        <td className="px-3 py-2.5">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
              item.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'
            }`}
          >
            {item.isActive ? copy.vehicleClasses.statusActive : copy.vehicleClasses.statusHidden}
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
          <Button onClick={() => setPanel({ mode: 'create' })}>{copy.vehicleClasses.addButton}</Button>
        )}
      </div>

      {(listError ?? order.error) && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {listError ?? order.error}
        </div>
      )}

      {items.length === 0 ? (
        <Card className="text-center text-sm text-neutral-500">{copy.vehicleClasses.empty}</Card>
      ) : search.isFiltering && search.filtered.length === 0 ? (
        <Card className="text-center text-sm text-neutral-500">
          {copy.common.nothingFoundFor(search.query.trim())}
        </Card>
      ) : (
        <Card padding="sm" className="overflow-x-auto">
          {search.isFiltering && (
            <p className="px-1 pb-2 text-xs text-neutral-400">{copy.common.reorderDisabledBySearch}</p>
          )}
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <th className="w-10 px-2 py-2.5">
                  <span className="sr-only">{copy.common.colOrder}</span>
                </th>
                <th className="px-3 py-2.5">{copy.common.colName}</th>
                <th className="px-3 py-2.5 text-right">{copy.vehicleClasses.colCapacity}</th>
                <th className="px-3 py-2.5 text-right">{copy.vehicleClasses.colLuggage}</th>
                <th className="px-3 py-2.5">{copy.vehicleClasses.colStatus}</th>
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
                  itemLabel={copy.vehicleClasses.sortableItem}
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
        title={panel?.mode === 'edit' ? copy.vehicleClasses.panelEdit : copy.vehicleClasses.panelCreate}
      >
        <VehicleClassForm
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
        title={copy.vehicleClasses.deleteTitle}
        initialFocusRef={cancelDeleteRef}
      >
        <p className="text-sm text-neutral-600">
          {confirmTarget && (
            <>
              {copy.vehicleClasses.deleteBefore}
              <span className="font-semibold text-neutral-900">{readLocalized(confirmTarget.translations).ru}</span>
              {copy.vehicleClasses.deleteAfter}
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
