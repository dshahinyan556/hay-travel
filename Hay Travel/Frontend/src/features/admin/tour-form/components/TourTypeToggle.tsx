import { useCopy } from '@/shared/i18n/defineCopy'
import { TourType } from '@/features/admin/lib/enums'
import { adminEnumsCopy } from '@/features/admin/lib/adminEnumsCopy'
import { tourFormCopy } from '@/features/admin/tour-form/lib/tourFormCopy'

interface TourTypeToggleProps {
  value: TourType
  onChange: (value: TourType) => void
  /** When locked (editing an existing product) the type is fixed — it cannot be changed after
   * creation, so the control renders read-only. */
  disabled?: boolean
}

const options: TourType[] = [TourType.Tour, TourType.Excursion]

/**
 * Segmented control for the tour/excursion switch. Changing it re-shapes the day block via the
 * reducer's day-count rule (Excursion = 1 day, Tour = 2+). Implemented as a radio group for
 * keyboard/AT users. In edit mode it's `disabled` — the product type is immutable once created
 * (the backend rejects a change too).
 */
export function TourTypeToggle({ value, onChange, disabled = false }: TourTypeToggleProps) {
  const copy = useCopy(tourFormCopy).header
  const typeLabels = useCopy(adminEnumsCopy).tourType

  return (
    <div
      role="radiogroup"
      aria-label={copy.type}
      className={`inline-flex rounded-xl border border-neutral-200 bg-neutral-100 p-1 ${
        disabled ? 'opacity-70' : ''
      }`}
    >
      {options.map((option) => {
        const selected = option === value
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            title={disabled && !selected ? copy.typeLocked : undefined}
            onClick={() => onChange(option)}
            className={`rounded-lg px-5 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30 ${
              disabled ? 'cursor-not-allowed' : 'cursor-pointer'
            } ${
              selected ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600 hover:text-neutral-800'
            }`}
          >
            {typeLabels[option]}
          </button>
        )
      })}
    </div>
  )
}
