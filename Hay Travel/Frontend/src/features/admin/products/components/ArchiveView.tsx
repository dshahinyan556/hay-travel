import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { AdminActionButton, Checkbox, Tooltip } from '@/shared/ui'
import { RestoreIcon, TrashIcon } from '@/shared/ui/icons'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { adminEnumsCopy } from '@/features/admin/lib/adminEnumsCopy'
import type { TourType } from '@/features/admin/lib/enums'
import { TourThumb, tourTitle } from '@/features/admin/ui/TourTableParts'
import type { TourInfoModel } from '@/shared/types/attours'
import { productsCopy } from '../lib/productsCopy'
import { productMeta } from '../lib/productsModel'
import { FeaturedBadge, ProductBadge, ProductMetaLine, ProductTitle } from './ProductRowParts'

export interface ArchiveViewProps {
  /** Archived products after the filters. */
  tours: TourInfoModel[]
  selected: ReadonlySet<number>
  onToggle: (id: number) => void
  /** Select every visible row, or clear the selection when all of them are already selected. */
  onToggleAll: () => void
  /** Why restoring is not allowed (no `products.Update`), or `null`. */
  restoreHint: string | null
  /** Why permanent deletion is not allowed (no `products.Delete`), or `null`. */
  deleteHint: string | null
  /** Which bulk action is in flight, if any. */
  pending: 'restore' | 'delete' | null
  /** Any mutation/revalidation of the screen is running — everything is locked meanwhile. */
  busy: boolean
  onRestore: () => void
  onDelete: () => void
}

/**
 * «Архив»: rows are picked with checkboxes, «Восстановить» / «Удалить навсегда» act on the picked
 * rows at once. These are one-off actions (like «Одобрить» on an order), not a draft — there is no
 * Save here. Deleting still asks for confirmation (`DeleteProductsModal`, owned by the page).
 *
 * The title of each row still links to the product card, as it did before the redesign.
 */
export function ArchiveView({
  tours,
  selected,
  onToggle,
  onToggleAll,
  restoreHint,
  deleteHint,
  pending,
  busy,
  onRestore,
  onDelete,
}: ArchiveViewProps) {
  const copy = useCopy(productsCopy)
  const typeLabels = useCopy(adminEnumsCopy).tourType
  const { locale } = useLocale()
  const selectedCount = tours.filter((t) => selected.has(t.id)).length
  const allSelected = tours.length > 0 && selectedCount === tours.length
  const selectAllRef = useRef<HTMLInputElement>(null)

  // `indeterminate` has no HTML attribute — it can only be set on the DOM node.
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = selectedCount > 0 && !allSelected
  }, [selectedCount, allSelected])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Same frame as `AdminToolbar`'s own card, so the archive's two actions read as the
            screen's toolbar — but they act immediately on the selection. */}
        <div className="flex w-full flex-wrap items-center gap-1.5 rounded-xl border border-neutral-200 bg-white p-2 sm:w-auto sm:gap-2">
          <Tooltip enabled={restoreHint !== null} content={restoreHint} cursor="not-allowed" className="flex-1 sm:flex-none">
            <AdminActionButton
              label={copy.archive.restore}
              icon={<RestoreIcon size={17} />}
              onClick={onRestore}
              disabled={busy || selectedCount === 0 || restoreHint !== null}
              pending={pending === 'restore'}
              className={restoreHint !== null ? 'w-full sm:w-auto' : 'flex-1 sm:flex-none'}
            />
          </Tooltip>
          <span aria-hidden="true" className="mx-1 hidden h-[22px] w-px shrink-0 bg-neutral-200 sm:block" />
          <Tooltip enabled={deleteHint !== null} content={deleteHint} cursor="not-allowed" className="flex-1 sm:flex-none">
            <AdminActionButton
              label={copy.archive.deleteForever}
              icon={<TrashIcon size={17} />}
              onClick={onDelete}
              disabled={busy || selectedCount === 0 || deleteHint !== null}
              pending={pending === 'delete'}
              variant="destructive"
              className={deleteHint !== null ? 'w-full sm:w-auto' : 'flex-1 sm:flex-none'}
            />
          </Tooltip>
        </div>
        <span className="text-xs text-neutral-500" aria-live="polite">
          {copy.archive.selected(selectedCount)}
        </span>
      </div>

      <div className="px-3">
        <Checkbox
          ref={selectAllRef}
          label={copy.archive.selectAll}
          checked={allSelected}
          disabled={busy}
          onChange={onToggleAll}
        />
      </div>

      <ul className="flex flex-col gap-2">
        {tours.map((tour) => {
          const title = tourTitle(tour, locale)
          const isSelected = selected.has(tour.id)
          const typeLabel = typeLabels[tour.type as TourType] ?? '—'
          return (
            <li
              key={tour.id}
              className={`flex items-center gap-3 rounded-xl border bg-white px-3 py-2.5 transition-colors ${
                isSelected ? 'border-neutral-500' : 'border-neutral-200'
              }`}
            >
              {/* 44px tap row on phones around the 18px box. */}
              <span className="flex min-h-11 shrink-0 items-center sm:min-h-0">
                <Checkbox
                  label={copy.archive.select(title.text)}
                  labelHidden
                  checked={isSelected}
                  disabled={busy}
                  onChange={() => onToggle(tour.id)}
                />
              </span>
              <span className="hidden sm:block">
                <TourThumb url={tour.mainImageUrl} alt="" size="md" />
              </span>
              <Link
                to={`/admin/tours/${tour.id}/edit`}
                className="min-w-0 flex-1 rounded-md hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30"
              >
                <ProductTitle text={title.text} empty={title.empty} />
                <ProductMetaLine parts={productMeta(tour, typeLabel, copy.row).slice(0, 1)} />
              </Link>
              <span className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center">
                {tour.isFeatured && <FeaturedBadge label={copy.row.featured} />}
                <ProductBadge tone="outline">{typeLabel}</ProductBadge>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
