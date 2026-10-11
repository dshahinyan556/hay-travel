import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { adminEnumsCopy } from '@/features/admin/lib/adminEnumsCopy'
import type { TourType } from '@/features/admin/lib/enums'
import { TourThumb, tourTitle } from '@/features/admin/ui/TourTableParts'
import type { TourInfoModel } from '@/shared/types/attours'
import { productsCopy } from '../lib/productsCopy'
import { productMeta, productPrice } from '../lib/productsModel'
import { FeaturedBadge, ProductBadge, ProductMetaLine, ProductTitle } from './ProductRowParts'

export interface ProductRowProps {
  tour: TourInfoModel
  /** The row's «⋮» menu. Rendered NEXT TO the link, not inside it — a button nested in an `<a>` is
   * invalid markup and swallows clicks. */
  actions?: ReactNode
}

/**
 * One row of the «Активные» view — built like `OrderRow`: the whole card is the link to the
 * product card (`/admin/tours/:id/edit`), with no buttons inside. Publishing, «Показывать в
 * избранном» and «В архив» all live on the product card now, in its draft + Save; the row only
 * reports their state as badges.
 *
 * Desktop: thumbnail · title + meta · badges over price. Phone (`<sm`): the same content stacked
 * as a card — title block on top, badges and price on one line below, no horizontal scroll.
 */
export function ProductRow({ tour, actions }: ProductRowProps) {
  const copy = useCopy(productsCopy).row
  const typeLabels = useCopy(adminEnumsCopy).tourType
  const { locale } = useLocale()
  const title = tourTitle(tour, locale)
  const price = productPrice(tour, locale, copy)

  return (
    <div className="flex items-start gap-1 rounded-xl border border-neutral-200 bg-white transition-colors hover:bg-neutral-50 sm:items-center">
      <Link
        to={`/admin/tours/${tour.id}/edit`}
        className="flex min-w-0 flex-1 flex-col gap-2.5 rounded-xl p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30 sm:flex-row sm:items-center sm:gap-4 sm:px-3.5"
      >
        <span className="flex min-w-0 flex-1 items-center gap-3 sm:gap-3.5">
          {/* Decorative: the title right next to it already names the link. */}
          <TourThumb url={tour.mainImageUrl} alt="" size="md" />
          <span className="min-w-0">
            <ProductTitle text={title.text} empty={title.empty} />
            <ProductMetaLine parts={productMeta(tour, typeLabels[tour.type as TourType] ?? '—', copy)} />
          </span>
        </span>

        <span className="flex flex-wrap items-center justify-between gap-2 sm:shrink-0 sm:flex-col sm:items-end sm:gap-1.5">
          <span className="flex flex-wrap gap-1.5 sm:justify-end">
            {tour.isFeatured && <FeaturedBadge label={copy.featured} />}
            <ProductBadge tone={tour.isActive ? 'published' : 'hidden'}>
              {tour.isActive ? copy.published : copy.hidden}
            </ProductBadge>
          </span>
          <span
            className={`text-sm tabular-nums ${price ? 'font-bold text-neutral-900' : 'text-neutral-400'}`}
          >
            {price ?? copy.noPrice}
          </span>
        </span>
      </Link>
      {actions && <div className="shrink-0 py-2 pr-2 sm:py-0">{actions}</div>}
    </div>
  )
}
