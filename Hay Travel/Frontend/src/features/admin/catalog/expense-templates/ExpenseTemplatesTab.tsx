import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Button, buttonClassName, Card, DragHandle, Modal, SortableList, Spinner } from '@/shared/ui'
import type { SortableRowRenderProps } from '@/shared/ui'
import { SidePanel } from '@/features/admin/ui/SidePanel'
import {
  createExpenseTemplate,
  deleteExpenseTemplate,
  updateExpenseTemplate,
} from '@/features/admin/api/adminCatalog'
import type { ExpenseTemplateInfoModel } from '@/shared/types/attours'
import { readLocalized, writeLocalized, writeLocalizedForUpdate } from '@/features/admin/catalog/lib/catalogMapper'
import { catalogErrorMessage } from '@/features/admin/catalog/lib/catalogErrors'
import { catalogRowId, nextSortOrder, useCatalogReorder } from '@/features/admin/catalog/lib/useCatalogReorder'
import { useCatalogSearch } from '@/features/admin/catalog/lib/useCatalogSearch'
import { CatalogSearchInput } from '@/features/admin/catalog/CatalogSearchInput'
import { ExpenseTemplateForm, type ExpenseTemplateFormValues } from './ExpenseTemplateForm'

interface ExpenseTemplatesTabProps {
  items: ExpenseTemplateInfoModel[]
  onMutated: () => void
}

type PanelState = { mode: 'create' } | { mode: 'edit'; item: ExpenseTemplateInfoModel } | null

export function ExpenseTemplatesTab({ items, onMutated }: ExpenseTemplatesTabProps) {
  const [panel, setPanel] = useState<PanelState>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<ExpenseTemplateInfoModel | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const cancelDeleteRef = useRef<HTMLButtonElement>(null)
  const order = useCatalogReorder({
    items,
    update: updateExpenseTemplate,
    onMutated,
    errorAction: 'изменить порядок расходов',
  })
  const search = useCatalogSearch(order.rows, (item) => {
    const name = readLocalized(item.translations)
    return `${name.ru} ${name.en}`
  })

  async function handleSubmit(values: ExpenseTemplateFormValues) {
    setIsSubmitting(true)
    setFormError(null)
    try {
      if (panel?.mode === 'edit') {
        await updateExpenseTemplate({
          id: panel.item.id,
          // Position is owned by drag-and-drop now — keep whatever the row already has.
          sortOrder: panel.item.sortOrder,
          translations: writeLocalizedForUpdate(values.name),
        })
      } else {
        await createExpenseTemplate({
          sortOrder: nextSortOrder(items),
          translations: writeLocalized(values.name),
        })
      }
      setPanel(null)
      onMutated()
    } catch (err) {
      setFormError(catalogErrorMessage(err, panel?.mode === 'edit' ? 'сохранить расход' : 'добавить расход'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function confirmDelete() {
    if (confirmTarget === null) return
    setListError(null)
    setPendingDeleteId(confirmTarget.id)
    try {
      await deleteExpenseTemplate(confirmTarget.id)
      setConfirmTarget(null)
      onMutated()
    } catch (err) {
      setListError(catalogErrorMessage(err, 'удалить расход'))
    } finally {
      setPendingDeleteId(null)
    }
  }

  /** Shared row markup. `sortable` is omitted while a search query is active — see `useCatalogSearch`. */
  function renderRow(item: ExpenseTemplateInfoModel, sortable?: SortableRowRenderProps) {
    const name = readLocalized(item.translations).ru
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
              label={`Перетащить «${name || `расход №${item.id}`}», чтобы изменить порядок`}
              {...sortable.attributes}
              {...sortable.listeners}
            />
          )}
        </td>
        <td className="px-3 py-2.5 font-medium text-neutral-900">
          {name || <span className="text-neutral-400">—</span>}
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
        <Button onClick={() => setPanel({ mode: 'create' })}>Добавить расход</Button>
      </div>

      {(listError ?? order.error) && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {listError ?? order.error}
        </div>
      )}

      {items.length === 0 ? (
        <Card className="text-center text-sm text-neutral-500">Доп. расходов пока нет.</Card>
      ) : search.isFiltering && search.filtered.length === 0 ? (
        <Card className="text-center text-sm text-neutral-500">Ничего не найдено по «{search.query.trim()}».</Card>
      ) : (
        <Card padding="sm" className="overflow-x-auto">
          {search.isFiltering && (
            <p className="px-1 pb-2 text-xs text-neutral-400">Изменение порядка недоступно во время поиска — очистите поле.</p>
          )}
          <table className="w-full min-w-[460px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <th className="w-10 px-2 py-2.5">
                  <span className="sr-only">Порядок</span>
                </th>
                <th className="px-3 py-2.5">Название</th>
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
                  itemLabel="Доп. расход"
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
        title={panel?.mode === 'edit' ? 'Доп. расход' : 'Новый доп. расход'}
      >
        <ExpenseTemplateForm
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
        title="Удалить расход?"
        initialFocusRef={cancelDeleteRef}
      >
        <p className="text-sm text-neutral-600">
          {confirmTarget && (
            <>
              Расход «<span className="font-semibold text-neutral-900">{readLocalized(confirmTarget.translations).ru}</span>»
              будет удалён безвозвратно. Если он используется в турах, сначала уберите его оттуда.
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
