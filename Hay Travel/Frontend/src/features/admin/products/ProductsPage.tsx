import { useMemo, useRef, useState } from 'react'
import { Link, useLoaderData, useNavigate, useRevalidator } from 'react-router'
import {
  deleteTour,
  getAllTours,
  getArchivedTours,
  setTourActive,
  setTourArchived,
} from '@/features/admin/api/adminTours'
import { Button, Modal, Spinner, buttonClassName } from '@/shared/ui'
import { ApiError } from '@/shared/lib/http'
import type { TourInfoModel } from '@/shared/types/attours'
import { tourTitleRu } from '@/features/admin/ui/TourTableParts'
import {
  emptyFilters,
  filterProducts,
  type ProductFilters,
} from './lib/filterProducts'
import { ProductsToolbar } from './components/ProductsToolbar'
import { ProductsTable, type ProductsView } from './components/ProductsTable'

/**
 * Loads both the active and the archived tour lists in parallel. Errors are NOT swallowed —
 * a rejection propagates to `AdminErrorBoundary`. Revalidated automatically after every
 * mutation (archive / restore / publish / delete) so the counts and lists stay in sync.
 */
export async function productsLoader() {
  const [active, archived] = await Promise.all([getAllTours(), getArchivedTours()])
  return { active, archived }
}

export function ProductsPage() {
  const { active, archived } = useLoaderData<typeof productsLoader>()
  const navigate = useNavigate()
  const revalidator = useRevalidator()

  const [view, setView] = useState<ProductsView>('active')
  const [filters, setFilters] = useState<ProductFilters>(emptyFilters)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  /** Tour queued for permanent deletion (drives the confirm modal), or null when closed. */
  const [confirmTarget, setConfirmTarget] = useState<TourInfoModel | null>(null)
  const cancelDeleteRef = useRef<HTMLButtonElement>(null)

  const isBusy = pendingId !== null || revalidator.state !== 'idle'
  const sourceList = view === 'active' ? active : archived
  const visible = useMemo(() => filterProducts(sourceList, filters), [sourceList, filters])

  function patchFilters(patch: Partial<ProductFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }))
  }

  function errorText(err: unknown, action: string): string {
    if (err instanceof ApiError) return `Не удалось ${action}: сервер вернул ошибку (${err.status}).`
    return `Не удалось ${action}: проверьте соединение и попробуйте ещё раз.`
  }

  /** Run a mutation on one tour, then revalidate. Shared plumbing for all row actions. */
  async function runMutation(id: number, action: string, fn: () => Promise<void>) {
    if (isBusy) return
    setActionError(null)
    setPendingId(id)
    try {
      await fn()
      await revalidator.revalidate()
    } catch (err) {
      setActionError(errorText(err, action))
    } finally {
      setPendingId(null)
    }
  }

  function openEdit(tour: TourInfoModel) {
    if (isBusy) return
    navigate(`/admin/tours/${tour.id}/edit`)
  }

  const togglePublish = (tour: TourInfoModel) =>
    runMutation(tour.id, tour.isActive ? 'снять с публикации' : 'опубликовать', () =>
      setTourActive(tour.id, !tour.isActive),
    )
  const archive = (tour: TourInfoModel) =>
    runMutation(tour.id, 'архивировать', () => setTourArchived(tour.id, true))
  const restore = (tour: TourInfoModel) =>
    runMutation(tour.id, 'восстановить', () => setTourArchived(tour.id, false))

  async function confirmDelete() {
    if (confirmTarget === null) return
    const { id } = confirmTarget
    setActionError(null)
    setPendingId(id)
    try {
      await deleteTour(id)
      setConfirmTarget(null)
      await revalidator.revalidate()
    } catch (err) {
      setActionError(errorText(err, 'удалить окончательно'))
    } finally {
      setPendingId(null)
    }
  }

  const emptyList = sourceList.length === 0
  const emptyAfterFilter = !emptyList && visible.length === 0

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-neutral-900">Продукты</h1>
          <p className="text-sm text-neutral-500">Все туры и экскурсии — поиск, фильтры, архив.</p>
        </div>
        <div className="ml-auto">
          <Link to="/admin/tours/new" className={buttonClassName('primary', 'md')}>
            Создать продукт
          </Link>
        </div>
      </header>

      {actionError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          <span aria-hidden="true">⚠️</span>
          <span>{actionError}</span>
        </div>
      )}

      <ProductsToolbar
        view={view}
        onViewChange={setView}
        activeCount={active.length}
        archivedCount={archived.length}
        filters={filters}
        onFiltersChange={patchFilters}
      />

      {emptyList ? (
        <EmptyState view={view} />
      ) : emptyAfterFilter ? (
        <p className="rounded-xl border border-dashed border-neutral-200 bg-white px-6 py-12 text-center text-sm text-neutral-500">
          Ничего не найдено по заданным фильтрам.
        </p>
      ) : (
        <ProductsTable
          tours={visible}
          view={view}
          pendingId={pendingId}
          isBusy={isBusy}
          onOpen={openEdit}
          onTogglePublish={togglePublish}
          onArchive={archive}
          onRestore={restore}
          onDelete={setConfirmTarget}
        />
      )}

      <Modal
        open={confirmTarget !== null}
        onClose={() => {
          if (pendingId === null) setConfirmTarget(null)
        }}
        title="Удалить окончательно?"
        initialFocusRef={cancelDeleteRef}
      >
        <p className="text-sm text-neutral-600">
          {confirmTarget && (
            <>
              Позиция{' '}
              <span className="font-semibold text-neutral-900">«{tourTitleRu(confirmTarget).text}»</span>{' '}
              и все её данные (дни, переводы, изображения) будут удалены безвозвратно. Это действие
              нельзя отменить.
            </>
          )}
        </p>
        <div className="mt-5 flex justify-end gap-2.5">
          <button
            ref={cancelDeleteRef}
            type="button"
            onClick={() => setConfirmTarget(null)}
            disabled={pendingId !== null}
            className={`${buttonClassName('ghost', 'md')} disabled:pointer-events-none disabled:opacity-50`}
          >
            Отмена
          </button>
          <Button
            type="button"
            variant="danger"
            onClick={confirmDelete}
            disabled={pendingId !== null}
            className="min-w-28"
          >
            {pendingId !== null ? (
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

/** Empty-list state, differs by view (no products at all vs. empty archive). */
function EmptyState({ view }: { view: ProductsView }) {
  if (view === 'archived') {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white px-6 py-14 text-center">
        <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
          <span aria-hidden="true" className="mb-2 text-2xl">
            🗄
          </span>
          <h2 className="text-base font-semibold text-neutral-800">Архив пуст</h2>
          <p className="text-sm text-neutral-500">
            Архивированные продукты появятся здесь. Отсюда их можно восстановить или удалить
            окончательно.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-6 py-14 text-center">
      <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
        <span
          aria-hidden="true"
          className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-2xl"
        >
          🧳
        </span>
        <h2 className="text-base font-semibold text-neutral-800">Пока нет ни одной позиции</h2>
        <p className="text-sm text-neutral-500">
          Создайте первый тур или экскурсию — они появятся здесь и на сайте.
        </p>
        <div className="mt-3">
          <Link to="/admin/tours/new" className={buttonClassName('primary', 'md')}>
            Создать продукт
          </Link>
        </div>
      </div>
    </div>
  )
}
