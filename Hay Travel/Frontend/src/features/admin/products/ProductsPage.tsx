import { useMemo, useRef, useState } from 'react'
import { Link, redirect, useLoaderData, useNavigate, useRevalidator } from 'react-router'
import {
  deleteTour,
  getAllTours,
  getArchivedTours,
  reorderFeaturedTours,
  setTourActive,
  setTourArchived,
  setTourFeatured,
} from '@/features/admin/api/adminTours'
import { Button, MaintenanceFormLayout, Modal, Spinner, buttonClassName } from '@/shared/ui'
import { ApiError } from '@/shared/lib/http'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { adminCommonCopy } from '@/features/admin/lib/adminCommonCopy'
import {
  AdminScreen,
  canView,
  ensurePermissionsReady,
  useScreenPermission,
} from '@/shared/auth'
import type { TourInfoModel } from '@/shared/types/attours'
import { tourTitle } from '@/features/admin/ui/TourTableParts'
import {
  emptyFilters,
  filterProducts,
  type ProductFilters,
} from './lib/filterProducts'
import { productsCopy } from './lib/productsCopy'
import { ProductsToolbar } from './components/ProductsToolbar'
import { ProductsTable, type ProductsView } from './components/ProductsTable'

const MAX_FEATURED = 9
/** `GlobalErrorCode.TooManyFeaturedTours` — surfaced as a specific message instead of the
 * generic "сервер вернул ошибку (400)". */
const TOO_MANY_FEATURED_CODE = 2011

function errorCodeOf(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const record = body as Record<string, unknown>
  const raw = record.errorCode ?? record.ErrorCode
  return typeof raw === 'number' ? raw : undefined
}

/** Sorted by `featuredSortOrder` — the order the public "избранное" section shows them in. */
function featuredOf(tours: TourInfoModel[]): TourInfoModel[] {
  return tours.filter((t) => t.isFeatured).sort((a, b) => a.featuredSortOrder - b.featuredSortOrder)
}

/**
 * Loads both the active and the archived tour lists in parallel. Errors are NOT swallowed —
 * a rejection propagates to `AdminErrorBoundary`. Revalidated automatically after every
 * mutation (archive / restore / publish / delete) so the counts and lists stay in sync.
 *
 * The screen used to have no guard of its own (every panel role could open it). With per-screen
 * permissions it needs one, or a role without `products.View` typing the URL would get a raw 403.
 */
export async function productsLoader() {
  await ensurePermissionsReady()
  if (!canView(AdminScreen.Products)) throw redirect('/admin')

  const [active, archived] = await Promise.all([getAllTours(), getArchivedTours()])
  return { active, archived }
}

/**
 * Template B — «Форма обслуживания» (`MaintenanceFormLayout`): many equal products with no "main"
 * one, created and deleted freely, edited one at a time. It differs from the catalogs only in
 * WHERE a record is edited — a full screen (`/admin/tours/:id/edit`, template A) rather than a
 * side panel — which makes this the list half of a list↔card pair, not a template of its own.
 *
 * «Создать продукт» is the archetype's single page-level action and therefore the only thing in
 * the control zone; there is no page-level Save, because this screen accumulates no draft.
 */
export function ProductsPage() {
  const { active, archived } = useLoaderData<typeof productsLoader>()
  const navigate = useNavigate()
  const revalidator = useRevalidator()
  const copy = useCopy(productsCopy)
  const common = useCopy(adminCommonCopy)
  const { locale } = useLocale()

  // Resolved once here and handed down as capabilities — the tables and toolbars stay
  // presentational and never ask about permissions themselves.
  const permission = useScreenPermission(AdminScreen.Products)
  const canDelete = permission.canDelete
  // Featuring and reordering are UPDATEs on the backend (§0.3), not a separate right.
  const canFeature = permission.canUpdate

  const [view, setView] = useState<ProductsView>('active')
  const [filters, setFilters] = useState<ProductFilters>(emptyFilters)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  /** Tour queued for permanent deletion (drives the confirm modal), or null when closed. */
  const [confirmTarget, setConfirmTarget] = useState<TourInfoModel | null>(null)
  const cancelDeleteRef = useRef<HTMLButtonElement>(null)

  const isBusy = pendingId !== null || revalidator.state !== 'idle'
  const featured = useMemo(() => featuredOf(active), [active])
  const sourceList = view === 'active' ? active : view === 'featured' ? featured : archived
  const visible = useMemo(() => filterProducts(sourceList, filters), [sourceList, filters])
  const canFeatureMore = featured.length < MAX_FEATURED

  function patchFilters(patch: Partial<ProductFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }))
  }

  function errorText(err: unknown, action: string): string {
    if (err instanceof ApiError) {
      if (errorCodeOf(err.body) === TOO_MANY_FEATURED_CODE) {
        return copy.errorTooManyFeatured(MAX_FEATURED)
      }
      return copy.errorServer(action, err.status)
    }
    return copy.errorNetwork(action)
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
    runMutation(tour.id, tour.isActive ? copy.action.unpublish : copy.action.publish, () =>
      setTourActive(tour.id, !tour.isActive),
    )
  const archive = (tour: TourInfoModel) =>
    runMutation(tour.id, copy.action.archive, () => setTourArchived(tour.id, true))
  const restore = (tour: TourInfoModel) =>
    runMutation(tour.id, copy.action.restore, () => setTourArchived(tour.id, false))
  const toggleFeatured = (tour: TourInfoModel) =>
    runMutation(tour.id, tour.isFeatured ? copy.action.unfeature : copy.action.feature, () =>
      setTourFeatured(tour.id, !tour.isFeatured),
    )

  /** Swaps the tour with its up/down neighbour in the featured order and sends the full
   * reordered id list — `ReorderFeatured` replaces the whole order, not a single position. */
  function moveFeatured(tour: TourInfoModel, direction: 'up' | 'down') {
    const ids = featured.map((t) => t.id)
    const from = ids.indexOf(tour.id)
    const to = direction === 'up' ? from - 1 : from + 1
    if (from === -1 || to < 0 || to >= ids.length) return
    ;[ids[from], ids[to]] = [ids[to], ids[from]]
    runMutation(tour.id, copy.action.reorder, () => reorderFeaturedTours(ids))
  }

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
      setActionError(errorText(err, copy.action.deleteForever))
    } finally {
      setPendingId(null)
    }
  }

  const emptyList = sourceList.length === 0
  const emptyAfterFilter = !emptyList && visible.length === 0

  return (
    <MaintenanceFormLayout
      title={copy.title}
      subtitle={copy.subtitle}
      /* Hidden, not disabled: the button has no informational content of its own. `ml-auto` keeps
         it at the right end of the control zone, where this archetype always puts its one filled
         action. Still a `Link`, not a button — it navigates, and turning it into an
         `AdminActionButton` would cost middle-click / open-in-new-tab for no structural gain. */
      controlZone={
        permission.canCreate && (
          <Link to="/admin/tours/new" className={`ml-auto ${buttonClassName('primary', 'md')}`}>
            {copy.create}
          </Link>
        )
      }
      message={
        actionError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            <span aria-hidden="true">⚠️</span>
            <span>{actionError}</span>
          </div>
        )
      }
    >
      <ProductsToolbar
        view={view}
        onViewChange={setView}
        canFeature={canFeature}
        activeCount={active.length}
        featuredCount={featured.length}
        archivedCount={archived.length}
        filters={filters}
        onFiltersChange={patchFilters}
      />

      {emptyList ? (
        <EmptyState view={view} canCreate={permission.canCreate} />
      ) : emptyAfterFilter ? (
        <p className="rounded-xl border border-dashed border-neutral-200 bg-white px-6 py-12 text-center text-sm text-neutral-500">
          {copy.noMatches}
        </p>
      ) : (
        <ProductsTable
          tours={visible}
          view={view}
          pendingId={pendingId}
          isBusy={isBusy}
          canFeatureMore={canFeatureMore}
          canDelete={canDelete}
          canFeature={canFeature}
          canUpdate={permission.canUpdate}
          onOpen={openEdit}
          onTogglePublish={togglePublish}
          onToggleFeatured={toggleFeatured}
          onMoveFeatured={moveFeatured}
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
        title={copy.deleteModal.title}
        initialFocusRef={cancelDeleteRef}
      >
        <p className="text-sm text-neutral-600">
          {confirmTarget && (
            <>
              {copy.deleteModal.lead}{' '}
              <span className="font-semibold text-neutral-900">
                {copy.deleteModal.quoteOpen}
                {tourTitle(confirmTarget, locale).text}
                {copy.deleteModal.quoteClose}
              </span>{' '}
              {copy.deleteModal.tail}
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
            {common.cancel}
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
                {copy.deleteModal.deleting}
              </span>
            ) : (
              common.delete
            )}
          </Button>
        </div>
      </Modal>
    </MaintenanceFormLayout>
  )
}

/** Empty-list state, differs by view (no products at all vs. empty archive vs. nothing featured). */
function EmptyState({ view, canCreate }: { view: ProductsView; canCreate: boolean }) {
  const copy = useCopy(productsCopy)

  if (view === 'featured') {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white px-6 py-14 text-center">
        <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
          <span aria-hidden="true" className="mb-2 text-2xl">
            ♡
          </span>
          <h2 className="text-base font-semibold text-neutral-800">{copy.empty.featuredTitle}</h2>
          <p className="text-sm text-neutral-500">{copy.empty.featuredText(MAX_FEATURED)}</p>
        </div>
      </div>
    )
  }

  if (view === 'archived') {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white px-6 py-14 text-center">
        <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
          <span aria-hidden="true" className="mb-2 text-2xl">
            🗄
          </span>
          <h2 className="text-base font-semibold text-neutral-800">{copy.empty.archivedTitle}</h2>
          <p className="text-sm text-neutral-500">{copy.empty.archivedText}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-6 py-14 text-center">
      <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
        <span
          aria-hidden="true"
          className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-2xl"
        >
          🧳
        </span>
        <h2 className="text-base font-semibold text-neutral-800">{copy.empty.title}</h2>
        <p className="text-sm text-neutral-500">{copy.empty.text}</p>
        {canCreate && (
          <div className="mt-3">
            <Link to="/admin/tours/new" className={buttonClassName('primary', 'md')}>
              {copy.create}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
