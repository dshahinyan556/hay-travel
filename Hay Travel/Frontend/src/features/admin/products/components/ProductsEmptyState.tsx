import type { ReactNode } from 'react'
import { useCopy } from '@/shared/i18n/defineCopy'
import { ArchiveIcon, CompassIcon, StarIcon } from '@/shared/ui/icons'
import { MAX_FEATURED_TOURS } from '@/features/admin/api/adminTours'
import { productsCopy } from '../lib/productsCopy'
import type { ProductsView } from '../lib/productsModel'

export interface ProductsEmptyStateProps {
  view: ProductsView
  /** «Создать продукт» for the "no products at all" case — already permission-aware. */
  createAction: ReactNode
}

/** Empty list, worded per view: no products at all / nothing featured / empty archive. */
export function ProductsEmptyState({ view, createAction }: ProductsEmptyStateProps) {
  const copy = useCopy(productsCopy).empty

  const { icon, title, text } =
    view === 'featured'
      ? { icon: <StarIcon size={26} />, title: copy.featuredTitle, text: copy.featuredText(MAX_FEATURED_TOURS) }
      : view === 'archived'
        ? { icon: <ArchiveIcon size={26} />, title: copy.archivedTitle, text: copy.archivedText }
        : { icon: <CompassIcon size={26} />, title: copy.title, text: copy.text }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-6 py-14 text-center">
      <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
        <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-500">
          {icon}
        </span>
        <h2 className="text-base font-semibold text-neutral-800">{title}</h2>
        <p className="text-sm text-neutral-500">{text}</p>
        {view === 'active' && <div className="mt-3">{createAction}</div>}
      </div>
    </div>
  )
}
