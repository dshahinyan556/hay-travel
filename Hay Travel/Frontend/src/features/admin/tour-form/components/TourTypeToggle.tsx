import { useCopy } from '@/shared/i18n/defineCopy'
import { TourType } from '@/features/admin/lib/enums'
import { adminEnumsCopy } from '@/features/admin/lib/adminEnumsCopy'
import { tourFormCopy } from '@/features/admin/tour-form/lib/tourFormCopy'
import { SegmentedRadio } from './SegmentedRadio'

interface TourTypeToggleProps {
  value: TourType
  onChange: (value: TourType) => void
  /** When locked (editing an existing product) the type is fixed — it cannot be changed after
   * creation, so the control renders read-only. */
  disabled?: boolean
}

const options: TourType[] = [TourType.Tour, TourType.Excursion, TourType.Transfer]

/**
 * Segmented control for the product type. Changing it re-shapes the rest of the form:
 *  - Excursion = exactly 1 day, Tour = 2+ (the reducer's day-count rule),
 *  - Transfer = no days at all, and a completely different body (route + prices instead of days,
 *    gallery, regions, tags, discount — решение 0.4).
 *
 * In edit mode it's `disabled` — the product type is immutable once created (the backend rejects
 * a change too), so a transfer can never turn into a tour after the fact.
 */
export function TourTypeToggle({ value, onChange, disabled = false }: TourTypeToggleProps) {
  const copy = useCopy(tourFormCopy).header
  const typeLabels = useCopy(adminEnumsCopy).tourType

  return (
    <SegmentedRadio
      label={copy.type}
      value={value}
      options={options.map((option) => ({ value: option, label: typeLabels[option] }))}
      onChange={onChange}
      disabled={disabled}
      disabledTitle={copy.typeLocked}
    />
  )
}
