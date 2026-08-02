import type { TourInfoModel } from '@/shared/types/attours'
import { TourThumb, TypeBadge, tourTitleRu } from '@/features/admin/ui/TourTableParts'

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
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isActive}
      aria-label={isActive ? 'Снять с публикации' : 'Опубликовать'}
      disabled={pending}
      onClick={onToggle}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 disabled:cursor-not-allowed disabled:opacity-60 ${
        isActive ? 'bg-brand-600' : 'bg-neutral-300'
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
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      disabled={disabled}
      aria-pressed={isFeatured}
      title={isFeatured ? 'Убрать из избранного' : 'Добавить в избранное'}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-base transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        isFeatured ? 'text-rose-600 hover:bg-rose-50' : 'text-neutral-400 hover:bg-neutral-100'
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
  onOpen,
  onTogglePublish,
  onToggleFeatured,
  onMoveFeatured,
  onArchive,
  onRestore,
  onDelete,
}: ProductsTableProps) {
  const isActiveView = view === 'active'
  const isFeaturedView = view === 'featured'

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="bg-neutral-50 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            <th className="w-[70px] px-4 py-2.5 font-semibold">Фото</th>
            <th className="px-4 py-2.5 font-semibold">Заголовок (RU)</th>
            <th className="w-[130px] px-4 py-2.5 font-semibold">Тип</th>
            <th className="w-20 px-4 py-2.5 text-right font-semibold">Дней</th>
            {isActiveView && <th className="w-[130px] px-4 py-2.5 font-semibold">Публикация</th>}
            {isFeaturedView && <th className="w-24 px-4 py-2.5 font-semibold">Порядок</th>}
            <th className="w-[190px] px-4 py-2.5 text-right font-semibold">Действия</th>
          </tr>
        </thead>
        <tbody>
          {tours.map((tour, index) => {
            const { text: title, empty } = tourTitleRu(tour)
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
                        pending={rowPending || isBusy}
                        onToggle={() => onTogglePublish(tour)}
                      />
                      <span
                        className={`text-xs font-semibold ${
                          tour.isActive ? 'text-brand-700' : 'text-neutral-400'
                        }`}
                      >
                        {tour.isActive ? 'На сайте' : 'Скрыт'}
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
                        <FeaturedToggle
                          isFeatured={tour.isFeatured}
                          disabled={isBusy || (!tour.isFeatured && !canFeatureMore)}
                          onToggle={() => onToggleFeatured(tour)}
                        />
                        <RowAction
                          onClick={() => onArchive(tour)}
                          disabled={isBusy}
                          label="🗄 В архив"
                        />
                      </>
                    )}
                    {isFeaturedView && (
                      <RowAction
                        onClick={() => onToggleFeatured(tour)}
                        disabled={isBusy}
                        label="✕ Убрать"
                        tone="danger"
                      />
                    )}
                    {view === 'archived' && (
                      <>
                        <RowAction
                          onClick={() => onRestore(tour)}
                          disabled={isBusy}
                          label="↩ Восстановить"
                        />
                        <RowAction
                          onClick={() => onDelete(tour)}
                          disabled={isBusy}
                          label="Удалить"
                          tone="danger"
                        />
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
