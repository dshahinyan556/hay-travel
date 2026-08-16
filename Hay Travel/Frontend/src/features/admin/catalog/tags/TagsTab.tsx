import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Button, buttonClassName, Card, DragHandle, Modal, SortableList, Spinner } from '@/shared/ui'
import type { SortableRowRenderProps } from '@/shared/ui'
import { TAG_COLOR_HEX } from '@/shared/ui/ProductTag'
import { SidePanel } from '@/features/admin/ui/SidePanel'
import { createTag, deleteTag, updateTag } from '@/features/admin/api/adminCatalog'
import type { TagInfoModel } from '@/shared/types/attours'
import { TagType, tagColorLabels } from '@/features/admin/lib/enums'
import { readLocalized, writeLocalized, writeLocalizedForUpdate } from '@/features/admin/catalog/lib/catalogMapper'
import { catalogErrorMessage } from '@/features/admin/catalog/lib/catalogErrors'
import { catalogRowId, nextSortOrder, useCatalogReorder } from '@/features/admin/catalog/lib/useCatalogReorder'
import { useCatalogSearch } from '@/features/admin/catalog/lib/useCatalogSearch'
import { CatalogSearchInput } from '@/features/admin/catalog/CatalogSearchInput'
import { TagForm, type TagFormValues } from './TagForm'

interface TagsTabProps {
  items: TagInfoModel[]
  onMutated: () => void
}

type PanelState = { mode: 'create' } | { mode: 'edit'; item: TagInfoModel } | null

function parsePercent(value: string): number {
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/** Product tags catalog — up to 3 per tour, at most 1 `Discount` (enforced when assigning, on
 * the tour form's `TagPicker`, not here: this screen manages the tag *definitions*, not which
 * tour has which). Same CRUD/drag-reorder shell as `ExpenseTemplatesTab`. */
export function TagsTab({ items, onMutated }: TagsTabProps) {
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
    errorAction: 'изменить порядок тегов',
  })
  const search = useCatalogSearch(order.rows, (item) => {
    const name = readLocalized(item.translations)
    return `${name.ru} ${name.en}`
  })

  async function handleSubmit(values: TagFormValues) {
    setIsSubmitting(true)
    setFormError(null)
    const discountPercent = values.type === TagType.Discount ? parsePercent(values.discountPercent) : null
    try {
      if (panel?.mode === 'edit') {
        await updateTag({
          id: panel.item.id,
          type: values.type,
          color: values.color,
          discountPercent,
          // Position is owned by drag-and-drop now — keep whatever the row already has.
          sortOrder: panel.item.sortOrder,
          translations: writeLocalizedForUpdate(values.name),
        })
      } else {
        await createTag({
          type: values.type,
          color: values.color,
          discountPercent,
          sortOrder: nextSortOrder(items),
          translations: writeLocalized(values.name),
        })
      }
      setPanel(null)
      onMutated()
    } catch (err) {
      setFormError(catalogErrorMessage(err, panel?.mode === 'edit' ? 'сохранить тег' : 'добавить тег'))
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
      setListError(catalogErrorMessage(err, 'удалить тег'))
    } finally {
      setPendingDeleteId(null)
    }
  }

  function renderRow(item: TagInfoModel, sortable?: SortableRowRenderProps) {
    const name = readLocalized(item.translations).ru
    const isDiscount = item.type === TagType.Discount
    return (
      <tr
        key={sortable ? undefined : item.id}
        ref={sortable?.setNodeRef}
        style={sortable?.style as CSSProperties | undefined}
        className={`border-b border-neutral-100 last:border-0 ${
          sortable?.isDragging ? 'relative z-10 bg-brand-50/60' : ''
        }`}
      >
        <td className="w-10 px-2 py-2.5">
          {sortable && (
            <DragHandle
              ref={sortable.setActivatorNodeRef}
              disabled={order.isSaving}
              label={`Перетащить «${name || `тег №${item.id}`}», чтобы изменить порядок`}
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
              title={tagColorLabels[item.color as 1 | 2 | 3 | 4 | 5]}
            />
            <span className="font-medium text-neutral-900">
              {name || <span className="text-neutral-400">—</span>}
            </span>
          </span>
        </td>
        <td className="px-3 py-2.5 text-sm text-neutral-600">
          {isDiscount ? `Скидка ${item.discountPercent ?? '—'}%` : 'Обычный'}
        </td>
        <td className="px-3 py-2.5">
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setPanel({ mode: 'edit', item })}
              className="rounded-lg px-2.5 py-1 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50"
            >
              Изменить
            </button>
            <button
              type="button"
              onClick={() => setConfirmTarget(item)}
              disabled={pendingDeleteId === item.id}
              className="rounded-lg px-2.5 py-1 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:pointer-events-none disabled:opacity-50"
            >
              Удалить
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CatalogSearchInput value={search.query} onChange={search.setQuery} placeholder="Поиск по названию…" />
        <Button onClick={() => setPanel({ mode: 'create' })}>Добавить тег</Button>
      </div>

      {(listError ?? order.error) && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {listError ?? order.error}
        </div>
      )}

      {items.length === 0 ? (
        <Card className="text-center text-sm text-neutral-500">Тегов пока нет.</Card>
      ) : search.isFiltering && search.filtered.length === 0 ? (
        <Card className="text-center text-sm text-neutral-500">Ничего не найдено по «{search.query.trim()}».</Card>
      ) : (
        <Card padding="sm" className="overflow-x-auto">
          {search.isFiltering && (
            <p className="px-1 pb-2 text-xs text-neutral-400">Изменение порядка недоступно во время поиска — очистите поле.</p>
          )}
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <th className="w-10 px-2 py-2.5">
                  <span className="sr-only">Порядок</span>
                </th>
                <th className="px-3 py-2.5">Название</th>
                <th className="px-3 py-2.5">Тип</th>
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
                  itemLabel="Тег"
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
        title={panel?.mode === 'edit' ? 'Тег' : 'Новый тег'}
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
        title="Удалить тег?"
        initialFocusRef={cancelDeleteRef}
      >
        <p className="text-sm text-neutral-600">
          {confirmTarget && (
            <>
              Тег «<span className="font-semibold text-neutral-900">{readLocalized(confirmTarget.translations).ru}</span>»
              будет удалён безвозвратно. Если он назначен турам, сначала уберите его оттуда.
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
            Отмена
          </button>
          <Button type="button" variant="danger" onClick={confirmDelete} disabled={pendingDeleteId !== null} className="min-w-28">
            {pendingDeleteId !== null ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size="sm" />
                Удаление…
              </span>
            ) : (
              'Удалить'
            )}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
