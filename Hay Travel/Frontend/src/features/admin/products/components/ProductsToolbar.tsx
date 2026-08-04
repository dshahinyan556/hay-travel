import { Input, Select, type SelectOption } from '@/shared/ui'
import { TourType } from '@/features/admin/lib/enums'
import type { ProductFilters, StatusFilter, TypeFilter } from '@/features/admin/products/lib/filterProducts'
import type { ProductsView } from './ProductsTable'

/**
 * `Select` speaks strings, while `TypeFilter` is `'all' | TourType` and `TourType` is numeric.
 * The option values below are therefore the stringified enum members, and the two parsers map
 * back — exhaustively over the options each list actually offers, so no cast is involved and an
 * unexpected value degrades to the harmless `'all'` instead of being asserted into the type.
 */
const TYPE_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'Все типы' },
  { value: String(TourType.Tour), label: 'Только туры' },
  { value: String(TourType.Excursion), label: 'Только экскурсии' },
]

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'Все статусы' },
  { value: 'published', label: 'На сайте' },
  { value: 'hidden', label: 'Скрыт' },
]

function parseTypeFilter(value: string): TypeFilter {
  if (value === String(TourType.Tour)) return TourType.Tour
  if (value === String(TourType.Excursion)) return TourType.Excursion
  return 'all'
}

function parseStatusFilter(value: string): StatusFilter {
  return value === 'published' || value === 'hidden' ? value : 'all'
}

interface ProductsToolbarProps {
  view: ProductsView
  onViewChange: (view: ProductsView) => void
  /** Admin-only (`SetFeatured`/`ReorderFeatured`) — hides the «Избранные» tab entirely for a
   * TourManager, who could only look at a list they cannot change. */
  canFeature: boolean
  activeCount: number
  featuredCount: number
  archivedCount: number
  filters: ProductFilters
  onFiltersChange: (patch: Partial<ProductFilters>) => void
}

/** One segment of the Активные | Архив switch. */
function ViewTab({
  selected,
  label,
  count,
  onClick,
}: {
  selected: boolean
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
        selected ? 'bg-white text-brand-800 shadow-sm' : 'text-neutral-600 hover:text-neutral-800'
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
          selected ? 'bg-brand-100 text-brand-800' : 'bg-neutral-200 text-neutral-500'
        }`}
      >
        {count}
      </span>
    </button>
  )
}

/**
 * The products list controls: the Активные | Архив switch, a title search box, and type /
 * status dropdowns. Stateless — filter values and the active view come from `ProductsPage`,
 * which owns them and does the filtering.
 */
export function ProductsToolbar({
  view,
  onViewChange,
  canFeature,
  activeCount,
  featuredCount,
  archivedCount,
  filters,
  onFiltersChange,
}: ProductsToolbarProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Pinned below the mobile hamburger bar (60px) on phones, flush to the viewport top on
          desktop where that bar doesn't exist. Bleeds to `main`'s own edges (`-mx-4 sm:-mx-6`)
          so the background covers content scrolling underneath it. */}
      <div className="sticky top-[60px] z-10 -mx-4 bg-neutral-50 px-4 pt-1 sm:-mx-6 sm:px-6 md:top-0">
        <div className="inline-flex w-fit rounded-xl border border-neutral-200 bg-neutral-100 p-1">
          <ViewTab
            selected={view === 'active'}
            label="Активные"
            count={activeCount}
            onClick={() => onViewChange('active')}
          />
          {canFeature && (
            <ViewTab
              selected={view === 'featured'}
              label="Избранные"
              count={featuredCount}
              onClick={() => onViewChange('featured')}
            />
          )}
          <ViewTab
            selected={view === 'archived'}
            label="Архив"
            count={archivedCount}
            onClick={() => onViewChange('archived')}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
          >
            🔍
          </span>
          <Input
            type="search"
            value={filters.search}
            onChange={(e) => onFiltersChange({ search: e.target.value })}
            placeholder="Поиск по заголовку (RU/EN)…"
            aria-label="Поиск по заголовку"
            className="pl-9"
          />
        </div>

        <div className="w-full sm:w-44">
          <Select
            surface="admin"
            value={String(filters.type)}
            onChange={(value) => onFiltersChange({ type: parseTypeFilter(value) })}
            options={TYPE_OPTIONS}
            aria-label="Фильтр по типу"
          />
        </div>

        {view === 'active' && (
          <div className="w-full sm:w-44">
            <Select
              surface="admin"
              value={filters.status}
              onChange={(value) => onFiltersChange({ status: parseStatusFilter(value) })}
              options={STATUS_OPTIONS}
              aria-label="Фильтр по публикации"
            />
          </div>
        )}
      </div>
    </div>
  )
}
