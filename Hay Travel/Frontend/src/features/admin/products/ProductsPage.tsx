import { useMemo, useState } from 'react'
import { redirect, useLoaderData, useRevalidator } from 'react-router'
import {
  deleteTour,
  getAllTours,
  getArchivedTours,
  isTooManyFeaturedError,
  MAX_FEATURED_TOURS,
  reorderFeaturedTours,
  setTourActive,
  setTourArchived,
  setTourFeatured,
} from '@/features/admin/api/adminTours'
import { ActionsMenu, InquiryScreenLayout, UnsavedChangesModal, type ActionsMenuItem } from '@/shared/ui'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { tourTitle } from '@/features/admin/ui/TourTableParts'
import { TourArchiveModal } from '@/features/admin/tour-form/components/TourArchiveModal'
import { AlertIcon } from '@/shared/ui/icons'
import { useUnsavedChangesGuard } from '@/shared/hooks'
import { ApiError } from '@/shared/lib/http'
import { useCopy } from '@/shared/i18n/defineCopy'
import { AdminScreen, canView, ensurePermissionsReady, useScreenPermission } from '@/shared/auth'
import type { TourInfoModel } from '@/shared/types/attours'
import { emptyFilters, filterProducts, type ProductFilters as ProductFiltersState } from './lib/filterProducts'
import { productsCopy } from './lib/productsCopy'
import { featuredOf, type ProductsView } from './lib/productsModel'
import { useFeaturedDraft } from './hooks/useFeaturedDraft'
import { ProductsViewChips } from './components/ProductsViewChips'
import { CreateProductLink } from './components/CreateProductLink'
import { ProductFilters } from './components/ProductFilters'
import { ProductRow } from './components/ProductRow'
import { FeaturedView } from './components/FeaturedView'
import { ArchiveView } from './components/ArchiveView'
import { DeleteProductsModal } from './components/DeleteProductsModal'
import { ProductsEmptyState } from './components/ProductsEmptyState'

/**
 * Loads both the active and the archived tour lists in parallel. Errors are NOT swallowed —
 * a rejection propagates to `AdminErrorBoundary`. Revalidated after every mutation (featured
 * save / restore / delete) so the counts and lists stay in sync.
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

/** Run `fn` for every id one by one (the backend has no bulk endpoints) and report which ids
 * failed together with the first error — a partial failure must not hide the successes. */
/** `GlobalErrorCode.TourHasOrders` — `DeleteTour` refuses a product that orders still point at. */
const TOUR_HAS_ORDERS_CODE = 2018

function errorCodeOf(err: unknown): number | undefined {
  if (!(err instanceof ApiError) || typeof err.body !== 'object' || err.body === null) return undefined
  const record = err.body as Record<string, unknown>
  const raw = record.errorCode ?? record.ErrorCode
  return typeof raw === 'number' ? raw : undefined
}

async function runForEach(
  ids: number[],
  fn: (id: number) => Promise<void>,
): Promise<{ failed: number[]; firstError: unknown }> {
  const failed: number[] = []
  let firstError: unknown = null
  for (const id of ids) {
    try {
      await fn(id)
    } catch (err) {
      if (failed.length === 0) firstError = err
      failed.push(id)
    }
  }
  return { failed, firstError }
}

/**
 * Продукты — a list↔card pair like «Заказы» (template D, `InquiryScreenLayout`): the control zone
 * holds the view chips (Активные / Избранные / Архив, with counts — they change what is SHOWN,
 * exactly like the order status chips) and the one filled action, «Создать продукт».
 *
 *  - Активные: every row is a link to the product card; nothing in a row mutates anything.
 *    Publishing, «Показывать в избранном» and «В архив» are edited on the card (draft + Save).
 *  - Избранные: the order/contents of the home page's «Избранное» block as a DRAFT with its own
 *    pinned Cancel/Save toolbar; leaving the page or switching the view with unsaved edits asks
 *    first (`UnsavedChangesModal`) — switching discards the draft only after "Переключить".
 *  - Архив: one-off bulk actions on checked rows (restore / delete forever), no draft.
 *
 * Permissions are resolved here once and handed down as hints: a locked action stays visible but
 * disabled, with "Недостаточно прав" as a tooltip (panel-wide rule, `orderPermissionHints`).
 */
export function ProductsPage() {
  const { active, archived } = useLoaderData<typeof productsLoader>()
  const revalidator = useRevalidator()
  const copy = useCopy(productsCopy)

  const permission = useScreenPermission(AdminScreen.Products)
  const createHint = permission.canCreate ? null : copy.noPermissionHint
  // Featuring/reordering and archive/restore are all UPDATEs on the backend (§0.3).
  const updateHint = permission.canUpdate ? null : copy.noPermissionHint
  const deleteHint = permission.canDelete ? null : copy.noPermissionHint

  const [view, setView] = useState<ProductsView>('active')
  /** View the admin asked for while the featured draft had unsaved edits — drives the confirm. */
  const [pendingView, setPendingView] = useState<ProductsView | null>(null)
  const [filters, setFilters] = useState<ProductFiltersState>(emptyFilters)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pending, setPending] = useState<'featured' | 'restore' | 'delete' | 'row' | null>(null)
  /** Product queued for «В архив» from its row menu (drives the confirm modal), or null. */
  const [archiveTarget, setArchiveTarget] = useState<TourInfoModel | null>(null)
  const { locale } = useLocale()
  const [selected, setSelected] = useState<ReadonlySet<number>>(() => new Set())
  /** Products queued for permanent deletion (drives the confirm modal); empty when closed. */
  const [deleteTargets, setDeleteTargets] = useState<TourInfoModel[]>([])

  const busy = pending !== null || revalidator.state !== 'idle'

  const featured = useMemo(() => featuredOf(active), [active])
  // Archiving does not clear `IsFeatured`, and the server counts — and `ReorderFeatured` requires —
  // every featured tour, archived ones included. They are not shown in the draft (off the site),
  // but they are part of the count and are appended to the reorder payload unchanged.
  const archivedFeatured = useMemo(() => featuredOf(archived), [archived])
  const featuredIds = useMemo(() => featured.map((t) => t.id), [featured])
  const draft = useFeaturedDraft(featuredIds)
  const guard = useUnsavedChangesGuard(draft.isDirty && pending !== 'featured')

  const toursById = useMemo(() => new Map(active.map((t) => [t.id, t])), [active])
  const featuredInDraftOrder = draft.order
    .map((id) => toursById.get(id))
    .filter((t): t is TourInfoModel => t !== undefined)

  const counts: Record<ProductsView, number> = {
    active: active.length,
    featured: featured.length,
    archived: archived.length,
  }

  const visibleActive = useMemo(() => filterProducts(active, filters), [active, filters])
  // The publication filter belongs to the active view only — an archived product is off the site
  // whatever its flag says, and a hidden filter must not silently narrow another view.
  const visibleArchived = useMemo(
    () => filterProducts(archived, { ...filters, status: 'all' }),
    [archived, filters],
  )
  const selectedVisible = visibleArchived.filter((t) => selected.has(t.id))

  function errorText(err: unknown, action: string): string {
    if (isTooManyFeaturedError(err)) return copy.menu.tooManyFeatured(MAX_FEATURED_TOURS)
    if (errorCodeOf(err) === TOUR_HAS_ORDERS_CODE) return copy.menu.hasOrders
    return err instanceof ApiError ? copy.errorServer(action, err.status) : copy.errorNetwork(action)
  }

  /** One immediate row action from the «⋮» menu: request → reload the lists, error into `message`. */
  async function runRowAction(action: string, fn: () => Promise<void>) {
    if (busy) return
    setActionError(null)
    setPending('row')
    try {
      await fn()
      await revalidator.revalidate()
    } catch (err) {
      setActionError(errorText(err, action))
    } finally {
      setPending(null)
    }
  }

  async function confirmArchive() {
    if (archiveTarget === null) return
    const { id } = archiveTarget
    await runRowAction(copy.menu.actionArchive, () => setTourArchived(id, true))
    setArchiveTarget(null)
  }

  /** Same pattern as the notification-templates list: a missing right hides the item rather than
   * greying it out, and a row with nothing left to offer gets no menu at all. */
  function rowActions(tour: TourInfoModel): ActionsMenuItem[] {
    const items: ActionsMenuItem[] = []
    if (permission.canUpdate) {
      items.push(
        {
          key: 'publish',
          label: tour.isActive ? copy.menu.unpublish : copy.menu.publish,
          onClick: () =>
            void runRowAction(tour.isActive ? copy.menu.actionUnpublish : copy.menu.actionPublish, () =>
              setTourActive(tour.id, !tour.isActive),
            ),
          disabled: busy,
        },
        {
          key: 'featured',
          label: tour.isFeatured ? copy.menu.unfeature : copy.menu.feature,
          onClick: () =>
            void runRowAction(tour.isFeatured ? copy.menu.actionUnfeature : copy.menu.actionFeature, () =>
              setTourFeatured(tour.id, !tour.isFeatured),
            ),
          disabled: busy,
        },
        { key: 'archive', label: copy.menu.archive, onClick: () => setArchiveTarget(tour), disabled: busy },
      )
    }
    if (permission.canDelete) {
      items.push({
        key: 'delete',
        label: copy.menu.deleteForever,
        onClick: () => setDeleteTargets([tour]),
        disabled: busy,
        danger: true,
      })
    }
    return items
  }

  function requestView(next: ProductsView) {
    if (next === view) return
    if (view === 'featured' && draft.isDirty) {
      setPendingView(next)
      return
    }
    setView(next)
    setActionError(null)
  }

  function confirmViewSwitch() {
    if (pendingView === null) return
    draft.reset()
    setView(pendingView)
    setPendingView(null)
    setActionError(null)
  }

  async function saveFeatured() {
    if (busy || !draft.isDirty) return
    setActionError(null)
    setPending('featured')
    try {
      // Removals first: `ReorderFeatured` must receive EXACTLY the set that is featured at that
      // moment, so the ids leaving the block have to be gone before the new order is sent.
      for (const id of draft.removed) await setTourFeatured(id, false)
      if (draft.isReordered) {
        await reorderFeaturedTours([...draft.keptOrder, ...archivedFeatured.map((t) => t.id)])
      }
      await revalidator.revalidate()
      draft.reset()
    } catch (err) {
      setActionError(errorText(err, copy.action.saveFeatured))
      // Whatever did go through is reloaded; the draft reconciles with it and keeps the rest.
      await revalidator.revalidate()
    } finally {
      setPending(null)
    }
  }

  function toggleSelected(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllVisible() {
    const allSelected = visibleArchived.length > 0 && selectedVisible.length === visibleArchived.length
    setSelected(allSelected ? new Set() : new Set(visibleArchived.map((t) => t.id)))
  }

  /** Shared plumbing of the two archive bulk actions: run, reload, report a partial failure and
   * keep exactly the failed rows selected so a retry is one click. */
  async function runBulk(kind: 'restore' | 'delete', ids: number[], action: string, fn: (id: number) => Promise<void>) {
    setActionError(null)
    setPending(kind)
    const { failed, firstError } = await runForEach(ids, fn)
    await revalidator.revalidate()
    setSelected(new Set(failed))
    if (failed.length > 0) {
      const base = errorText(firstError, action)
      setActionError(ids.length > 1 ? `${base} ${copy.errorPartial(failed.length, ids.length)}` : base)
    }
    setPending(null)
  }

  function restoreSelected() {
    if (busy || selectedVisible.length === 0) return
    void runBulk(
      'restore',
      selectedVisible.map((t) => t.id),
      copy.action.restore,
      (id) => setTourArchived(id, false),
    )
  }

  async function confirmDelete() {
    if (busy || deleteTargets.length === 0) return
    await runBulk(
      'delete',
      deleteTargets.map((t) => t.id),
      copy.action.deleteForever,
      deleteTour,
    )
    setDeleteTargets([])
  }

  const createAction = <CreateProductLink label={copy.create} hint={createHint} />

  return (
    <InquiryScreenLayout
      title={copy.title}
      subtitle={copy.subtitle}
      controlZone={
        <>
          <ProductsViewChips view={view} onChange={requestView} counts={counts} />
          <CreateProductLink label={copy.create} hint={createHint} className="w-full sm:ml-auto sm:w-auto" />
        </>
      }
      message={
        actionError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            <AlertIcon size={17} className="mt-0.5 shrink-0" />
            <span>{actionError}</span>
          </div>
        )
      }
    >
      {view === 'featured' ? (
        featured.length === 0 ? (
          <ProductsEmptyState view="featured" createAction={createAction} />
        ) : (
          <FeaturedView
            tours={featuredInDraftOrder}
            draft={draft}
            archivedFeaturedCount={archivedFeatured.length}
            updateHint={updateHint}
            pending={pending === 'featured'}
            onSave={() => void saveFeatured()}
            onCancel={draft.reset}
          />
        )
      ) : (
        <>
          <ProductFilters filters={filters} onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))} showStatus={view === 'active'} />

          {view === 'active' ? (
            active.length === 0 ? (
              <ProductsEmptyState view="active" createAction={createAction} />
            ) : visibleActive.length === 0 ? (
              <NoMatches text={copy.noMatches} />
            ) : (
              <>
                <p className="text-xs text-neutral-500">{copy.productsUnit(visibleActive.length)}</p>
                <ul className="flex flex-col gap-2.5">
                  {visibleActive.map((tour) => {
                    const items = rowActions(tour)
                    return (
                      <li key={tour.id}>
                        <ProductRow
                          tour={tour}
                          actions={
                            items.length > 0 && (
                              <ActionsMenu items={items} label={copy.menu.label(tourTitle(tour, locale).text)} />
                            )
                          }
                        />
                      </li>
                    )
                  })}
                </ul>
              </>
            )
          ) : archived.length === 0 ? (
            <ProductsEmptyState view="archived" createAction={createAction} />
          ) : visibleArchived.length === 0 ? (
            <NoMatches text={copy.noMatches} />
          ) : (
            <ArchiveView
              tours={visibleArchived}
              selected={selected}
              onToggle={toggleSelected}
              onToggleAll={toggleAllVisible}
              restoreHint={updateHint}
              deleteHint={deleteHint}
              pending={pending === 'restore' || pending === 'delete' ? pending : null}
              busy={busy}
              onRestore={restoreSelected}
              onDelete={() => setDeleteTargets(selectedVisible)}
            />
          )}
        </>
      )}

      <TourArchiveModal
        open={archiveTarget !== null}
        productTitle={archiveTarget ? tourTitle(archiveTarget, locale).text : ''}
        pending={pending === 'row'}
        hasUnsavedChanges={false}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => void confirmArchive()}
      />

      <DeleteProductsModal
        targets={deleteTargets}
        pending={pending === 'delete'}
        onCancel={() => setDeleteTargets([])}
        onConfirm={() => void confirmDelete()}
      />

      {/* Leaving the page with an unsaved featured draft … */}
      <UnsavedChangesModal open={guard.isBlocking} onCancel={guard.cancel} onConfirm={guard.confirm} />
      {/* … and switching the view with one: same dialog, worded for the switch. */}
      <UnsavedChangesModal
        open={pendingView !== null}
        onCancel={() => setPendingView(null)}
        onConfirm={confirmViewSwitch}
        title={copy.featured.switchTitle}
        message={copy.featured.switchMessage}
        confirmLabel={copy.featured.switchConfirm}
      />
    </InquiryScreenLayout>
  )
}

function NoMatches({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-neutral-200 bg-white px-6 py-12 text-center text-sm text-neutral-500">
      {text}
    </p>
  )
}
