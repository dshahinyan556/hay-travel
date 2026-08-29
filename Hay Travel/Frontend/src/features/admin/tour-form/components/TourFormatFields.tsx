import { Field, Input } from '@/shared/ui'
import { HelpButton } from '@/shared/ui/HelpButton'
import { HelpRevealZone } from '@/shared/ui/HelpReveal'
import { useCopy } from '@/shared/i18n/defineCopy'
import { TourFormat } from '@/features/admin/lib/enums'
import { adminEnumsCopy } from '@/features/admin/lib/adminEnumsCopy'
import { tourFormCopy } from '@/features/admin/tour-form/lib/tourFormCopy'
import { SegmentedRadio } from './SegmentedRadio'

export interface TourFormatFieldsProps {
  value: TourFormat | null
  onChange: (value: TourFormat) => void
  /** Per-person price, kept as a string while in the input (like every other price here). */
  groupPricePerPerson: string
  onChangeGroupPricePerPerson: (value: string) => void
  /** Seats per departure — one number for the whole product. */
  groupCapacity: string
  onChangeGroupCapacity: (value: string) => void
  formatError?: string
  groupPricePerPersonError?: string
  groupCapacityError?: string
}

const options: TourFormat[] = [TourFormat.Individual, TourFormat.Group, TourFormat.Both]

/**
 * «Формат» + the two fields that only a group format has (батч 2026-08-29, пункты 3.4/3.5).
 *
 * Rendered ONLY for a tour/excursion — a transfer has no format at all (`null` on the wire), so
 * the caller omits this block entirely rather than disabling it.
 *
 * The two group fields appear only at `Group`/`Both`, because they are meaningless at
 * `Individual` and the mapper sends them as `null` there (the backend rejects the combination
 * with `InvalidGroupPricing`/2051). Showing them greyed out would suggest the numbers are still
 * stored somewhere; they are not.
 *
 * The wording carries the real risk of this screen: TWO different prices live on one form, and
 * they are not derived from each other. "Цена за группу" (header) is a fixed total with a
 * group-size surcharge; "Цена за человека" (here) is multiplied by the guest count with no
 * surcharge. Each says so behind its own "?" — never as inline prose.
 */
export function TourFormatFields({
  value,
  onChange,
  groupPricePerPerson,
  onChangeGroupPricePerPerson,
  groupCapacity,
  onChangeGroupCapacity,
  formatError,
  groupPricePerPersonError,
  groupCapacityError,
}: TourFormatFieldsProps) {
  const copy = useCopy(tourFormCopy).header
  const formatLabels = useCopy(adminEnumsCopy).tourFormat
  const showGroupFields = value === TourFormat.Group || value === TourFormat.Both

  return (
    <div className="flex flex-col gap-3">
      <HelpRevealZone className="flex flex-col gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
          <span>
            {copy.format}
            <span aria-hidden="true" className="ml-0.5 text-rose-700">
              *
            </span>
          </span>
          <HelpButton surface="admin" title={copy.format}>
            {copy.formatHint}
          </HelpButton>
        </span>
        <SegmentedRadio
          label={copy.format}
          value={value}
          options={options.map((option) => ({ value: option, label: formatLabels[option] }))}
          onChange={onChange}
          invalid={Boolean(formatError)}
        />
        {formatError && (
          <p role="alert" className="text-xs font-medium text-rose-700">
            {formatError}
          </p>
        )}
      </HelpRevealZone>

      {showGroupFields && (
        <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <span className="text-[11px] font-bold uppercase tracking-[.08em] text-neutral-500">
            {copy.groupPricing}
          </span>
          {/* Две колонки на планшете и шире, одна на 375px — цифры узкие, но подписи длинные. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={copy.groupPricePerPerson}
              htmlFor="tour-group-price-per-person"
              required
              hint={copy.groupPricePerPersonHint}
              error={groupPricePerPersonError}
            >
              <Input
                id="tour-group-price-per-person"
                type="text"
                inputMode="decimal"
                value={groupPricePerPerson}
                onChange={(e) => onChangeGroupPricePerPerson(e.target.value)}
                placeholder="0"
                error={Boolean(groupPricePerPersonError)}
              />
            </Field>
            <Field
              label={copy.groupCapacity}
              htmlFor="tour-group-capacity"
              required
              hint={copy.groupCapacityHint}
              error={groupCapacityError}
            >
              <Input
                id="tour-group-capacity"
                type="text"
                inputMode="numeric"
                value={groupCapacity}
                onChange={(e) => onChangeGroupCapacity(e.target.value)}
                placeholder="0"
                error={Boolean(groupCapacityError)}
              />
            </Field>
          </div>
        </div>
      )}
    </div>
  )
}
