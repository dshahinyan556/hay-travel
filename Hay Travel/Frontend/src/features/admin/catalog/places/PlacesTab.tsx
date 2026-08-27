import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Button, buttonClassName, Card, DragHandle, Modal, SortableList, Spinner } from '@/shared/ui'
import type { SortableRowRenderProps } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminCommonCopy } from '@/features/admin/lib/adminCommonCopy'
import { SidePanel } from '@/features/admin/ui/SidePanel'
import { createPlace, deletePlace, updatePlace } from '@/features/admin/api/adminCatalog'
import type { ScreenPermission } from '@/shared/auth'
import type { PlaceInfoModel, RegionInfoModel } from '@/shared/types/attours'
import { readLocalized, writeLocalized, writeLocalizedForUpdate } from '@/features/admin/catalog/lib/catalogMapper'
import { catalogCopy } from '@/features/admin/catalog/lib/catalogCopy'
import { catalogErrorMessage } from '@/features/admin/catalog/lib/catalogErrors'
import { catalogRowId, nextSortOrder, useCatalogReorder } from '@/features/admin/catalog/lib/useCatalogReorder'
import { useCatalogSearch } from '@/features/admin/catalog/lib/useCatalogSearch'
import { CatalogSearchInput } from '@/features/admin/catalog/CatalogSearchInput'
import { PlaceForm, type PlaceFormValues } from './PlaceForm'

interface PlacesTabProps {
  places: PlaceInfoModel[]
  /** `null` when the role may edit points but not read regions — the region picker then renders
   * disabled with an explanation rather than as a silently empty dropdown. */
  regions: RegionInfoModel[] | null
  /** The four flags of `catalog.places`, resolved once by `CatalogPage`. */
  permission: ScreenPermission
  /** Called after a successful create/update/delete — the parent revalidates the loader. */
  onMutated: () => void
}

type PanelState = { mode: 'create' } | { mode: 'edit'; place: PlaceInfoModel } | null

function parseOptionalDecimal(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const n = Number(trimmed.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function PlacesTab({ places, regions, permission, onMutated }: PlacesTabProps) {
  const copy = useCopy(catalogCopy)
  const common = useCopy(adminCommonCopy)
  const [panel, setPanel] = useState<PanelState>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<PlaceInfoModel | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const cancelDeleteRef = useRef<HTMLButtonElement>(null)
  const order = useCatalogReorder({
    items: places,
    update: updatePlace,
    onMutated,
    errorAction: copy.places.actions.reorder,
  })

  const regionName = (regionId: number) => {
    const region = regions?.find((r) => r.id === regionId)
    return region ? readLocalized(region.translations).ru || region.slug : copy.common.emptyValue
  }

  const search = useCatalogSearch(order.rows, (place) => {
    const name = readLocalized(place.translations)
    return `${name.ru} ${name.en} ${place.slug} ${regionName(place.regionId)}`
  })

  async function handleSubmit(values: PlaceFormValues) {
    setIsSubmitting(true)
    setFormError(null)
    const shared = {
      slug: values.slug.trim(),
      regionId: Number(values.regionId),
      latitude: parseOptionalDecimal(values.latitude),
      longitude: parseOptionalDecimal(values.longitude),
      imageUrl: values.imageUrl.trim(),
    }
    try {
      if (panel?.mode === 'edit') {
        await updatePlace({
          id: panel.place.id,
          regionSlug: panel.place.regionSlug,
          // Position is owned by drag-and-drop now — keep whatever the row already has.
          sortOrder: panel.place.sortOrder,
          ...shared,
          translations: writeLocalizedForUpdate(values.name),
          // `id: serverId ?? 0` — same by-id reconcile convention as translations above and as
          // GalleryImages in the tour form: 0 reads as "new row" server-side.
          images: values.images.map((img, i) => ({ id: img.serverId ?? 0, url: img.url.trim(), sortOrder: i })),
        })
      } else {
        await createPlace({
          ...shared,
          sortOrder: nextSortOrder(places),
          translations: writeLocalized(values.name),
          images: values.images.map((img, i) => ({ url: img.url.trim(), sortOrder: i })),
        })
      }
      setPanel(null)
      onMutated()
    } catch (err) {
      setFormError(
        catalogErrorMessage(
          copy,
          err,
          panel?.mode === 'edit' ? copy.places.actions.save : copy.places.actions.add,
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
      await deletePlace(confirmTarget.id)
      setConfirmTarget(null)
      onMutated()
    } catch (err) {
      setListError(catalogErrorMessage(copy, err, copy.places.actions.delete))
    } finally {
      setPendingDeleteId(null)
    }
  }

  /** Shared row markup. `sortable` is omitted while a search query is active — see `useCatalogSearch`. */
  function renderRow(place: PlaceInfoModel, sortable?: SortableRowRenderProps) {
    const name = readLocalized(place.translations).ru
    return (
      <tr
        key={sortable ? undefined : place.id}
        ref={sortable?.setNodeRef}
        style={sortable?.style as CSSProperties | undefined}
        className={`border-b border-neutral-100 last:border-0 ${
          sortable?.isDragging ? 'relative z-10 bg-neutral-100/60' : ''
        }`}
      >
        <td className="w-10 px-2 py-2.5">
          {sortable && (
            <DragHandle
              // Reordering PERSISTS through `updatePlace` — it is an edit, not a view preference.
              disabled={order.isSaving || !permission.canUpdate}
              ref={sortable.setActivatorNodeRef}
              label={copy.common.dragToReorder(name || place.slug)}
              {...sortable.attributes}
              {...sortable.listeners}
            />
          )}
        </td>
        <td className="px-3 py-2.5 font-medium text-neutral-900">
          {name || <span className="text-neutral-400">{copy.common.emptyValue}</span>}
        </td>
        <td className="px-3 py-2.5 text-neutral-500">{place.slug}</td>
        <td className="px-3 py-2.5 text-neutral-500">{regionName(place.regionId)}</td>
        <td className="px-3 py-2.5">
          <div className="flex justify-end gap-1.5">
            {permission.canUpdate && (
              <button
                type="button"
                onClick={() => setPanel({ mode: 'edit', place })}
                className="rounded-lg px-2.5 py-1 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
              >
                {common.edit}
              </button>
            )}
            {permission.canDelete && (
              <button
                type="button"
                onClick={() => setConfirmTarget(place)}
                disabled={pendingDeleteId === place.id}
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
          placeholder={copy.places.searchPlaceholder}
        />
        {permission.canCreate && (
          <Button onClick={() => setPanel({ mode: 'create' })}>{copy.places.addButton}</Button>
        )}
      </div>

      {(listError ?? order.error) && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {listError ?? order.error}
        </div>
      )}

      {places.length === 0 ? (
        <Card className="text-center text-sm text-neutral-500">{copy.places.empty}</Card>
      ) : search.isFiltering && search.filtered.length === 0 ? (
        <Card className="text-center text-sm text-neutral-500">
          {copy.common.nothingFoundFor(search.query.trim())}
        </Card>
      ) : (
        <Card padding="sm" className="overflow-x-auto">
          {search.isFiltering && (
            <p className="px-1 pb-2 text-xs text-neutral-400">{copy.common.reorderDisabledBySearch}</p>
          )}
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <th className="w-10 px-2 py-2.5">
                  <span className="sr-only">{copy.common.colOrder}</span>
                </th>
                <th className="px-3 py-2.5">{copy.common.colName}</th>
                <th className="px-3 py-2.5">{copy.places.colSlug}</th>
                <th className="px-3 py-2.5">{copy.places.colRegion}</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {search.isFiltering ? (
                search.filtered.map((place) => renderRow(place))
              ) : (
                <SortableList
                  items={order.rows}
                  getId={catalogRowId}
                  onReorder={order.reorder}
                  itemLabel={copy.places.sortableItem}
                >
                  {(place, _index, sortable) => renderRow(place, sortable)}
                </SortableList>
              )}
            </tbody>
          </table>
        </Card>
      )}

      <SidePanel
        open={panel !== null}
        onClose={() => setPanel(null)}
        title={panel?.mode === 'edit' ? copy.places.panelEdit : copy.places.panelCreate}
      >
        <PlaceForm
          key={panel?.mode === 'edit' ? panel.place.id : 'create'}
          place={panel?.mode === 'edit' ? panel.place : null}
          regions={regions}
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
        title={copy.places.deleteTitle}
        initialFocusRef={cancelDeleteRef}
      >
        <p className="text-sm text-neutral-600">
          {confirmTarget && (
            <>
              {copy.places.deleteBefore}
              <span className="font-semibold text-neutral-900">{readLocalized(confirmTarget.translations).ru}</span>
              {copy.places.deleteAfter}
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
