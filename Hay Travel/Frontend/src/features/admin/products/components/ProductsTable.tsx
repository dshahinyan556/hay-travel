import type { TourInfoModel } from '@/shared/types/attours'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { adminCommonCopy } from '@/features/admin/lib/adminCommonCopy'
import { TourThumb, TypeBadge, tourTitle } from '@/features/admin/ui/TourTableParts'
import { productsCopy } from '../lib/productsCopy'

export type ProductsView = 'active' | 'featured' | 'archived'

interface ProductsTableProps {
  tours: TourInfoModel[]
  view: ProductsView
  /** Id of the row whose request is in flight, or null. */
  pendingId: number | null
  /** True while any mutation or revalidation is running — disables all actions. */
  isBusy: boolean
  /** Active view only: false once 6 tours are already featured — disables the heart button on
   * tours that aren't featured yet (removing an already-featured one is always allowed). */
  canFeatureMore: boolean
  /** `products.Delete` — hides the permanent-delete action in the archive view. Archiving and
   * restoring stay available on `products.Update`, being reversible. */
  canDelete: boolean
  /**
   * `products.Update` — hides the heart toggle and the reorder controls.
   *
   * Featuring is an UPDATE, not a category of its own: the backend moved `SetFeatured` and
   * `ReorderFeatured` under `products.Update` (§0.3), and the two must agree or the UI offers a
   * control that answers 403.
   */
  canFeature: boolean
  /** `products.Update` — the publish toggle and archive/restore. Separate prop from `canFeature`
   * even though both currently resolve from the same flag: they gate different endpoints, and
   * collapsing them would hide that if either ever moves. */
  canUpdate: boolean
  /** Open a product for editing (row click / title click). */
  onOpen: (tour: TourInfoModel) => void
  /** Active view: toggle publication. */
  onTogglePublish: (tour: TourInfoModel) => void
  /** Active + Featured views: toggle the featured flag. */
  onToggleFeatured: (tour: TourInfoModel) => void
  /** Featured view: move one position up/down within the featured order. */
  onMoveFeatured: (tour: TourInfoModel, direction: 'up' | 'down') => void
  /** Active view: move to archive (soft-delete). */
  onArchive: (tour: TourInfoModel) => void
  /** Archive view: restore back to the active list. */
  onRestore: (tour: TourInfoModel) => void
  /** Archive view: permanently delete (opens confirmation upstream). */
  onDelete: (tour: TourInfoModel) => void
}

/**
 * Accessible publish switch (`role="switch"`). Flipping it is an immediate side effect on the
 * server; `pending` disables and dims it while the request is in flight.
 */
function PublishToggle({
  isActive,
  pending,
  onToggle,
}: {
  isActive: boolean
  pending: boolean
  onToggle: () => void
}) {
  const copy = useCopy(productsCopy).table
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isActive}
      aria-label={isActive ? copy.unpublish : copy.publish}
      disabled={pending}
      onClick={onToggle}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30 disabled:cursor-not-allowed disabled:opacity-60 ${
        isActive ? 'bg-neutral-950' : 'bg-neutral-300'
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          isActive ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

/** A small text/icon action button used in the actions column. */
function RowAction({
  onClick,
  disabled,
  label,
  tone = 'neutral',
}: {
  onClick: () => void
  disabled: boolean
  label: string
  tone?: 'neutral' | 'danger'
}) {
  const toneClass =
    tone === 'danger'
      ? 'text-rose-600 hover:bg-rose-50'
      : 'text-neutral-700 hover:bg-neutral-100'
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      disabled={disabled}
      className={`inline-flex items-center rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${toneClass}`}
    >
      {label}
    </button>
  )
}

/** Heart toggle for the featured flag — ♥/♡ rather than a custom SVG, matching the admin's
 * existing emoji-based icon language (🗄/↩/🔍/⚠️/🧳), which is deliberately separate from the
 * public site's line-icon set (see `shared/ui/icons.tsx`'s own doc comment). */
function FeaturedToggle({
  isFeatured,
  disabled,
  onToggle,
}: {
  isFeatured: boolean
  disabled: boolean
  onToggle: () => void
}) {
  const copy = useCopy(productsCopy).table
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      disabled={disabled}
      aria-pressed={isFeatured}
      title={isFeatured ? copy.unfeature : copy.feature}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-base transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        isFeatured ? 'text-neutral-900 hover:bg-neutral-100' : 'text-neutral-400 hover:bg-neutral-100'
      }`}
    >
      {isFeatured ? '♥' : '♡'}
    </button>
  )
}

/**
 * The products list table. Rows are clickable (mouse) and carry a keyboard-focusable title
 * button — both open the product for editing. Per-row actions depend on `view`:
 *  - active: publish toggle + featured heart (capped at 6) + "В архив",
 *  - featured: reorder (▲▼) + "✕ Убрать из избранного",
 *  - archived: "Восстановить" + "Удалить" (permanent).
 * Mutations are owned by the parent (`ProductsPage`); this component only renders and delegates.
 */
export function ProductsTable({
  tours,
  view,
  pendingId,
  isBusy,
  canFeatureMore,
  canDelete,
  canFeature,
  canUpdate,
  onOpen,
  onTogglePublish,
  onToggleFeatured,
  onMoveFeatured,
  onArchive,
  onRestore,
  onDelete,
}: ProductsTableProps) {
  const copy = useCopy(productsCopy).table
  const common = useCopy(adminCommonCopy)
  // Read once here rather than per row: `tourTitle` is called inside the `.map()` below.
  const { locale } = useLocale()
  const isActiveView = view === 'active'
  // Without `canFeature` the featured view isn't reachable (its tab is hidden) — but guard the
  // column here too, so the reorder controls can never render without the permission to use them.
  const isFeaturedView = view === 'featured' && canFeature

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="bg-neutral-50 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            <th className="w-[70px] px-4 py-2.5 font-semibold">{copy.colPhoto}</th>
            <th className="px-4 py-2.5 font-semibold">{copy.colTitle}</th>
            <th className="w-[130px] px-4 py-2.5 font-semibold">{copy.colType}</th>
            <th className="w-20 px-4 py-2.5 text-right font-semibold">{copy.colDays}</th>
            {isActiveView && (
              <th className="w-[130px] px-4 py-2.5 font-semibold">{copy.colPublication}</th>
            )}
            {isFeaturedView && (
              <th className="w-24 px-4 py-2.5 font-semibold">{copy.colOrder}</th>
            )}
            <th className="w-[190px] px-4 py-2.5 text-right font-semibold">{copy.colActions}</th>
          </tr>
        </thead>
        <tbody>
          {tours.map((tour, index) => {
            const { text: title, empty } = tourTitle(tour, locale)
            const rowPending = pendingId === tour.id
            return (
              <tr
                key={tour.id}
                onClick={() => !isBusy && onOpen(tour)}
                className="cursor-pointer border-t border-neutral-100 text-sm transition-colors hover:bg-neutral-50"
              >
                <td className="px-4 py-2.5">
                  <TourThumb url={tour.mainImageUrl} alt={title} />
                </td>
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpen(tour)
                    }}
                    className={`text-left font-semibold hover:underline ${
                      empty ? 'text-neutral-400' : 'text-neutral-900'
                    }`}
                  >
                    {title}
                  </button>
                </td>
                <td className="px-4 py-2.5">
                  <TypeBadge type={tour.type} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className="font-semibold tabular-nums text-neutral-800">
                    {tour.tourDays.length}
                  </span>
                </td>
                {isActiveView && (
                  <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <PublishToggle
                        isActive={tour.isActive}
                        pending={rowPending || isBusy || !canUpdate}
                        onToggle={() => onTogglePublish(tour)}
                      />
                      <span
                        className={`text-xs font-semibold ${
                          tour.isActive ? 'text-neutral-900' : 'text-neutral-400'
                        }`}
                      >
                        {tour.isActive ? copy.published : copy.hidden}
                      </span>
                    </div>
                  </td>
                )}
                {isFeaturedView && (
                  <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-0.5">
                      <RowAction
                        onClick={() => onMoveFeatured(tour, 'up')}
                        disabled={isBusy || index === 0}
                        label="▲"
                      />
                      <RowAction
                        onClick={() => onMoveFeatured(tour, 'down')}
                        disabled={isBusy || index === tours.length - 1}
                        label="▼"
                      />
                    </div>
                  </td>
                )}
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    {isActiveView && (
                      <>
                        {canFeature && (
                          <FeaturedToggle
                            isFeatured={tour.isFeatured}
                            disabled={isBusy || (!tour.isFeatured && !canFeatureMore)}
                            onToggle={() => onToggleFeatured(tour)}
                          />
                        )}
                        {canUpdate && (
                          <RowAction
                            onClick={() => onArchive(tour)}
                            disabled={isBusy}
                            label={copy.archive}
                          />
                        )}
                      </>
                    )}
                    {isFeaturedView && (
                      <RowAction
                        onClick={() => onToggleFeatured(tour)}
                        disabled={isBusy}
                        label={copy.removeFromFeatured}
                        tone="danger"
                      />
                    )}
                    {view === 'archived' && (
                      <>
                        {canUpdate && (
                          <RowAction
                            onClick={() => onRestore(tour)}
                            disabled={isBusy}
                            label={copy.restore}
                          />
                        )}
                        {canDelete && (
                          <RowAction
                            onClick={() => onDelete(tour)}
                            disabled={isBusy}
                            label={common.delete}
                            tone="danger"
                          />
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
