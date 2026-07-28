/**
 * Pure client-side filtering for the products list. No state, no I/O — takes the loaded tours
 * and the current filter selection and returns the subset to render.
 */

import { LanguageCode, TourTranslationType } from '@/features/admin/lib/enums'
import type { TourType } from '@/features/admin/lib/enums'
import type { TourInfoModel } from '@/shared/types/attours'

export type TypeFilter = 'all' | TourType
export type StatusFilter = 'all' | 'published' | 'hidden'

export interface ProductFilters {
  /** Free-text query matched against the RU and EN titles (case-insensitive). */
  search: string
  type: TypeFilter
  status: StatusFilter
}

export const emptyFilters: ProductFilters = { search: '', type: 'all', status: 'all' }

/** Concatenated RU+EN title of a tour, lower-cased for matching. */
function titleHaystack(tour: TourInfoModel): string {
  return tour.translations
    .filter(
      (t) =>
        t.type === TourTranslationType.Title &&
        (t.languageCode === LanguageCode.Russian || t.languageCode === LanguageCode.English),
    )
    .map((t) => t.value ?? '')
    .join(' ')
    .toLowerCase()
}

export function filterProducts(tours: TourInfoModel[], filters: ProductFilters): TourInfoModel[] {
  const query = filters.search.trim().toLowerCase()

  return tours.filter((tour) => {
    if (query !== '' && !titleHaystack(tour).includes(query)) return false
    if (filters.type !== 'all' && tour.type !== filters.type) return false
    if (filters.status === 'published' && !tour.isActive) return false
    if (filters.status === 'hidden' && tour.isActive) return false
    return true
  })
}
