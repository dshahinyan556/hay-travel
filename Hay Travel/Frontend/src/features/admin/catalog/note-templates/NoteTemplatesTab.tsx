import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Button, buttonClassName, Card, DragHandle, Modal, SortableList, Spinner } from '@/shared/ui'
import type { SortableRowRenderProps } from '@/shared/ui'
import { SidePanel } from '@/features/admin/ui/SidePanel'
import {
  createTourNoteTemplate,
  deleteTourNoteTemplate,
  updateTourNoteTemplate,
} from '@/features/admin/api/adminCatalog'
import { TourNoteType } from '@/features/admin/lib/enums'
import type { TourNoteTemplateInfoModel } from '@/shared/types/attours'
import { readLocalized, writeLocalized, writeLocalizedForUpdate } from '@/features/admin/catalog/lib/catalogMapper'
import { catalogErrorMessage } from '@/features/admin/catalog/lib/catalogErrors'
import { catalogRowId, nextSortOrder, useCatalogReorder } from '@/features/admin/catalog/lib/useCatalogReorder'
import { useCatalogSearch } from '@/features/admin/catalog/lib/useCatalogSearch'
import { CatalogSearchInput } from '@/features/admin/catalog/CatalogSearchInput'
import { NoteTemplateForm, type NoteTemplateFormValues } from './NoteTemplateForm'

interface NoteTemplatesTabProps {
  items: TourNoteTemplateInfoModel[]
  onMutated: () => void
}

type PanelState = { mode: 'create' } | { mode: 'edit'; item: TourNoteTemplateInfoModel } | null
type TypeFilter = 'all' | TourNoteType

const TYPE_LABELS: Record<number, string> = {
  [TourNoteType.OrganizationalDetail]: 'Организационная деталь',
  [TourNoteType.Restriction]: 'Ограничение',
  [TourNoteType.Included]: 'Включено',
  [TourNoteType.NotIncluded]: 'Не включено',
}

const typeLabel = (type: number) => TYPE_LABELS[type] ?? 'Организационная деталь'

const TYPE_FILTER_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: TourNoteType.OrganizationalDetail, label: 'Орг. детали' },
  { value: TourNoteType.Restriction, label: 'Ограничения' },
  { value: TourNoteType.Included, label: 'Включено' },
  { value: TourNoteType.NotIncluded, label: 'Не включено' },
]

/**
 * Both note types share ONE flat list here, and so does `sortOrder`. That is deliberate:
 * `TourNoteTemplate` has only a plain (non-unique) index on `Type` and no `(Type, SortOrder)`
 * constraint (`TourNoteTemplateConfiguration.cs`), so nothing on the backend expects positions
 * to restart per type. Dragging renumbers the whole table `0..n-1`; the tour form, which filters
 * templates by type, still sees each type's rows in exactly the order shown here, because
 * filtering a sorted list preserves its order.
 */
export function NoteTemplatesTab({ items, onMutated }: NoteTemplatesTabProps) {
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
    errorAction: 'изменить порядок заметок',
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
      setFormError(catalogErrorMessage(err, panel?.mode === 'edit' ? 'сохранить заметку' : 'добавить заметку'))
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
      setListError(catalogErrorMessage(err, 'удалить заметку'))
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
          sortable?.isDragging ? 'relative z-10 bg-brand-50/60' : ''
        }`}
      >
        <td className="w-10 px-2 py-2.5">
          {sortable && (
            <DragHandle
              ref={sortable.setActivatorNodeRef}
              disabled={order.isSaving}
              label={`Перетащить «${name || `заметку №${item.id}`}», чтобы изменить порядок`}
              {...sortable.attributes}
              {...sortable.listeners}
            />
          )}
        </td>
        <td className="px-3 py-2.5 font-medium text-neutral-900">
          {name || <span className="text-neutral-400">—</span>}
        </td>
        <td className="px-3 py-2.5 text-neutral-500">{typeLabel(item.type)}</td>
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
        <div className="flex flex-wrap items-center gap-3">
          <CatalogSearchInput value={search.query} onChange={search.setQuery} placeholder="Поиск по названию…" />
          <div
            role="radiogroup"
            aria-label="Тип заметки"
            className="inline-flex rounded-xl border border-neutral-200 bg-neutral-100 p-1"
          >
            {TYPE_FILTER_OPTIONS.map((option) => {
              const selected = option.value === typeFilter
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTypeFilter(option.value)}
                  className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 ${
                    selected ? 'bg-white text-brand-800 shadow-sm' : 'text-neutral-600 hover:text-neutral-800'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
        <Button onClick={() => setPanel({ mode: 'create' })}>Добавить заметку</Button>
      </div>

      {(listError ?? order.error) && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {listError ?? order.error}
        </div>
      )}

      {items.length === 0 ? (
        <Card className="text-center text-sm text-neutral-500">Заметок пока нет.</Card>
      ) : isNarrowing && search.filtered.length === 0 ? (
        <Card className="text-center text-sm text-neutral-500">
          {search.isFiltering ? <>Ничего не найдено по «{search.query.trim()}».</> : 'Заметок этого типа пока нет.'}
        </Card>
      ) : (
        <Card padding="sm" className="overflow-x-auto">
          {isNarrowing && (
            <p className="px-1 pb-2 text-xs text-neutral-400">Изменение порядка недоступно во время фильтрации — сбросьте поиск и тип.</p>
          )}
          <table className="w-full min-w-[560px] text-left text-sm">
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
              {isNarrowing ? (
                search.filtered.map((item) => renderRow(item))
              ) : (
                <SortableList
                  items={order.rows}
                  getId={catalogRowId}
                  onReorder={order.reorder}
                  itemLabel="Заметка"
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
        title={panel?.mode === 'edit' ? 'Заметка' : 'Новая заметка'}
      >
        <NoteTemplateForm
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
        title="Удалить заметку?"
        initialFocusRef={cancelDeleteRef}
      >
        <p className="text-sm text-neutral-600">
          {confirmTarget && (
            <>
              Заметка «<span className="font-semibold text-neutral-900">{readLocalized(confirmTarget.translations).ru}</span>»
              будет удалена безвозвратно. Если она используется в турах, сначала уберите её оттуда.
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
