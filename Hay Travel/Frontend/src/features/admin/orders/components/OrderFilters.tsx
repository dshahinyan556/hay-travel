import { Button, DatePicker, Input, Select } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import type { TourInfoModel } from '@/shared/types/attours'
import { ordersCopy } from '../lib/ordersCopy'
import { emptyOrderFilters, hasActiveFilters, tourTitleResolver, type OrderFiltersState } from '../lib/ordersModel'

export interface OrderFiltersProps {
  filters: OrderFiltersState
  onChange: (filters: OrderFiltersState) => void
  tours: TourInfoModel[]
}

/**
 * Filter bar above the Заказы list — tour / client / order id / departure-date range. All
 * client-side against the already-loaded order list (same architecture as the status tabs above
 * it), not a server round trip: the dataset is small and already sitting in the loader's data.
 */
export function OrderFilters({ filters, onChange, tours }: OrderFiltersProps) {
  const copy = useCopy(ordersCopy)
  const { locale } = useLocale()
  const tourTitle = tourTitleResolver(tours, locale, copy)
  const tourOptions = [
    { value: '', label: copy.filterTourAll },
    ...tours.map((tour) => ({ value: String(tour.id), label: tourTitle(tour.id) })),
  ]

  function set<K extends keyof OrderFiltersState>(key: K, value: OrderFiltersState[K]) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-neutral-500">
          {copy.filterTourLabel}
          <Select
            value={filters.tourId === null ? '' : String(filters.tourId)}
            onChange={(value) => set('tourId', value === '' ? null : Number(value))}
            options={tourOptions}
            className="mt-1 w-full"
          />
        </label>

        <label className="text-xs text-neutral-500">
          {copy.filterClientLabel}
          <Input
            value={filters.client}
            onChange={(e) => set('client', e.target.value)}
            placeholder={copy.filterClientPlaceholder}
            className="mt-1"
          />
        </label>

        <label className="text-xs text-neutral-500">
          {copy.filterNumberLabel}
          <Input
            value={filters.numberQuery}
            onChange={(e) => set('numberQuery', e.target.value)}
            placeholder={copy.filterNumberPlaceholder}
            className="mt-1"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-neutral-500">
            {copy.filterDateFromLabel}
            <DatePicker
              value={filters.dateFrom}
              onChange={(value) => set('dateFrom', value)}
              surface="admin"
              className="mt-1"
            />
          </label>
          <label className="text-xs text-neutral-500">
            {copy.filterDateToLabel}
            <DatePicker
              value={filters.dateTo}
              onChange={(value) => set('dateTo', value)}
              surface="admin"
              className="mt-1"
            />
          </label>
        </div>
      </div>

      {hasActiveFilters(filters) && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange(emptyOrderFilters)}
          className="min-h-11 w-fit"
        >
          {copy.filtersClear}
        </Button>
      )}
    </div>
  )
}
