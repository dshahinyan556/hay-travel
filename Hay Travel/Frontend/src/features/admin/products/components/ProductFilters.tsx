import { Input, Select, type SelectOption } from '@/shared/ui'
import { SearchIcon } from '@/shared/ui/icons'
import { useCopy } from '@/shared/i18n/defineCopy'
import { TourType } from '@/features/admin/lib/enums'
import type { ProductFilters as ProductFiltersState, StatusFilter, TypeFilter } from '../lib/filterProducts'
import { productsCopy } from '../lib/productsCopy'

/**
 * `Select` speaks strings, while `TypeFilter` is `'all' | TourType` and `TourType` is numeric.
 * The option values are therefore the stringified enum members, and the two parsers map back —
 * exhaustively over the options each list actually offers, so no cast is involved and an
 * unexpected value degrades to the harmless `'all'` instead of being asserted into the type.
 * The lists themselves are built per render (below) because their captions follow the interface
 * language; only the parsers stay module-level, since values never change.
 */
function parseTypeFilter(value: string): TypeFilter {
  if (value === String(TourType.Tour)) return TourType.Tour
  if (value === String(TourType.Excursion)) return TourType.Excursion
  if (value === String(TourType.Transfer)) return TourType.Transfer
  return 'all'
}

function parseStatusFilter(value: string): StatusFilter {
  return value === 'published' || value === 'hidden' ? value : 'all'
}

export interface ProductFiltersProps {
  filters: ProductFiltersState
  onChange: (patch: Partial<ProductFiltersState>) => void
  /** The publication filter only makes sense in the «Активные» view (archived products are off the
   * site regardless of their flag). */
  showStatus: boolean
}

/**
 * Title search + type / publication dropdowns. Stateless — the values come from `ProductsPage`,
 * which owns them and does the filtering. Phones: search on its own line, the two dropdowns side
 * by side under it (mockup's phone frame).
 */
export function ProductFilters({ filters, onChange, showStatus }: ProductFiltersProps) {
  const copy = useCopy(productsCopy).filters

  const typeOptions: SelectOption[] = [
    { value: 'all', label: copy.typeAll },
    { value: String(TourType.Tour), label: copy.typeToursOnly },
    { value: String(TourType.Excursion), label: copy.typeExcursionsOnly },
    { value: String(TourType.Transfer), label: copy.typeTransfersOnly },
  ]

  const statusOptions: SelectOption[] = [
    { value: 'all', label: copy.statusAll },
    { value: 'published', label: copy.statusPublished },
    { value: 'hidden', label: copy.statusHidden },
  ]

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:flex sm:items-center">
      <div className="relative col-span-2 sm:flex-1">
        <SearchIcon
          size={17}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400"
        />
        <Input
          type="search"
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
          placeholder={copy.searchPlaceholder}
          aria-label={copy.searchLabel}
          className="pl-9"
        />
      </div>

      <div className={`min-w-0 sm:w-48 ${showStatus ? '' : 'col-span-2'}`}>
        <Select
          surface="admin"
          value={String(filters.type)}
          onChange={(value) => onChange({ type: parseTypeFilter(value) })}
          options={typeOptions}
          aria-label={copy.typeFilterLabel}
        />
      </div>

      {showStatus && (
        <div className="min-w-0 sm:w-48">
          <Select
            surface="admin"
            value={filters.status}
            onChange={(value) => onChange({ status: parseStatusFilter(value) })}
            options={statusOptions}
            aria-label={copy.statusFilterLabel}
          />
        </div>
      )}
    </div>
  )
}
