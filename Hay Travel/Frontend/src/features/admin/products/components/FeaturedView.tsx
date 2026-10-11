import { Link } from 'react-router'
import { AdminToolbar, DragHandle, SortableList, Tooltip } from '@/shared/ui'
import { CloseIcon } from '@/shared/ui/icons'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { MAX_FEATURED_TOURS } from '@/features/admin/api/adminTours'
import { adminEnumsCopy } from '@/features/admin/lib/adminEnumsCopy'
import type { TourType } from '@/features/admin/lib/enums'
import { TourThumb, tourTitle } from '@/features/admin/ui/TourTableParts'
import type { TourInfoModel } from '@/shared/types/attours'
import type { FeaturedDraft } from '../hooks/useFeaturedDraft'
import { productsCopy } from '../lib/productsCopy'
import { productMeta } from '../lib/productsModel'
import { DraftTag, ProductMetaLine, ProductTitle } from './ProductRowParts'

export interface FeaturedViewProps {
  /** Featured products in the draft's display order (`draft.order`), removed ones included. */
  tours: TourInfoModel[]
  draft: FeaturedDraft
  /** Featured products sitting in the archive — counted by the server towards the limit, but not
   * listed here (they are off the site). */
  archivedFeaturedCount: number
  /** Why the draft cannot be saved/edited (no `products.Update`), or `null`. */
  updateHint: string | null
  /** A save (or another mutation of the screen) is in flight. */
  pending: boolean
  onSave: () => void
  onCancel: () => void
}

const stableId = (tour: TourInfoModel): string => String(tour.id)

/**
 * «Избранные»: the order of the home page's «Избранное» block, edited as a draft — drag by the
 * handle to reorder, the cross marks a product «уберётся» (with «Вернуть»), nothing is sent until
 * Save in the toolbar above. The toolbar (Cancel/Save only — nothing to add or delete here) is
 * pinned while scrolling exactly like `DataEntryScreenLayout`'s control zone, so Save stays in
 * reach on a long list.
 *
 * Presentational: the draft and the save itself belong to `ProductsPage`.
 */
export function FeaturedView({
  tours,
  draft,
  archivedFeaturedCount,
  updateHint,
  pending,
  onSave,
  onCancel,
}: FeaturedViewProps) {
  const copy = useCopy(productsCopy)
  const typeLabels = useCopy(adminEnumsCopy).tourType
  const { locale } = useLocale()
  const locked = updateHint !== null
  const featuredCount = tours.length + archivedFeaturedCount

  return (
    <div className="flex flex-col gap-3">
      {/* Same pin as `DataEntryScreenLayout`'s control zone: below the mobile hamburger bar (60px)
          on phones, flush to the top on desktop, bleeding to `main`'s edges so rows scrolling
          underneath are covered. */}
      <div className="sticky top-[60px] z-10 -mx-4 flex flex-wrap items-center gap-3 bg-neutral-50 px-4 py-2 sm:-mx-6 sm:px-6 md:top-0">
        <AdminToolbar
          className="w-full sm:w-auto"
          onCancel={onCancel}
          onSave={onSave}
          cancelState={{ disabled: pending || !draft.isDirty }}
          saveState={{ disabled: pending || !draft.isDirty || locked, pending, hint: updateHint }}
        />
        {draft.isDirty && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
            {copy.featured.changes(draft.changeCount)}
          </span>
        )}
      </div>

      <p className="text-xs text-neutral-500">
        {copy.featured.lead} ·{' '}
        <b className="font-semibold text-neutral-900 tabular-nums">
          {copy.featured.ofMax(featuredCount, MAX_FEATURED_TOURS)}
        </b>
        {archivedFeaturedCount > 0 && <> ({copy.featured.archivedNote(archivedFeaturedCount)})</>}
      </p>

      <ul className="flex flex-col gap-2">
        <SortableList items={tours} getId={stableId} onReorder={draft.reorder} itemLabel={copy.featured.itemLabel}>
          {(tour, _index, sortable) => {
            const title = tourTitle(tour, locale)
            const removed = draft.removed.has(tour.id)
            const moved = !removed && draft.moved.has(tour.id)
            const rowLocked = locked || pending || removed
            return (
              <li
                ref={sortable.setNodeRef}
                style={sortable.style}
                className={`relative flex items-center gap-2.5 rounded-xl border bg-white px-2.5 py-2 sm:gap-3 sm:px-3 ${
                  sortable.isDragging
                    ? 'z-10 border-neutral-400 shadow-lg'
                    : moved
                      ? 'border-blue-600 shadow-[inset_3px_0_0_var(--color-blue-600)]'
                      : 'border-neutral-200'
                }`}
              >
                <Tooltip enabled={locked} content={updateHint} cursor="not-allowed">
                  <DragHandle
                    ref={sortable.setActivatorNodeRef}
                    {...sortable.attributes}
                    {...sortable.listeners}
                    label={copy.featured.drag(title.text)}
                    disabled={rowLocked}
                  />
                </Tooltip>
                <span className={`hidden sm:block ${removed ? 'opacity-55' : ''}`}>
                  <TourThumb url={tour.mainImageUrl} alt="" size="md" />
                </span>
                {/* The title still opens the product card, as every row of this screen did before;
                    leaving with an unsaved draft is caught by the page's unsaved-changes guard. */}
                <Link
                  to={`/admin/tours/${tour.id}/edit`}
                  className={`min-w-0 flex-1 rounded-md hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30 ${removed ? 'opacity-55' : ''}`}
                >
                  <ProductTitle text={title.text} empty={title.empty} struck={removed} />
                  <ProductMetaLine parts={productMeta(tour, typeLabels[tour.type as TourType] ?? '—', copy.row).slice(0, 1)} />
                </Link>
                {moved && <DraftTag tone="moved">{copy.featured.moved}</DraftTag>}
                {removed ? (
                  <>
                    <DraftTag tone="removed">{copy.featured.removed}</DraftTag>
                    <button
                      type="button"
                      onClick={() => draft.restore(tour.id)}
                      disabled={pending}
                      aria-label={copy.featured.undoLabel(title.text)}
                      className="min-h-11 shrink-0 cursor-pointer px-1 text-xs font-semibold text-neutral-700 underline underline-offset-2 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-0"
                    >
                      {copy.featured.undo}
                    </button>
                  </>
                ) : (
                  <Tooltip enabled={locked} content={updateHint} cursor="not-allowed">
                    <button
                      type="button"
                      onClick={() => draft.remove(tour.id)}
                      disabled={locked || pending}
                      aria-label={copy.featured.remove(title.text)}
                      title={copy.featured.remove(title.text)}
                      className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:w-8"
                    >
                      <CloseIcon size={16} />
                    </button>
                  </Tooltip>
                )}
              </li>
            )
          }}
        </SortableList>
      </ul>
    </div>
  )
}
