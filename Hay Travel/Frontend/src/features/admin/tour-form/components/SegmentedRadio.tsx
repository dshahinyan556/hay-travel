export interface SegmentedRadioOption<T extends string | number> {
  value: T
  label: string
}

export interface SegmentedRadioProps<T extends string | number> {
  /** Accessible name of the group — the same caption shown above it. */
  label: string
  value: T | null
  options: SegmentedRadioOption<T>[]
  onChange: (value: T) => void
  /** Read-only mode (e.g. the product type in edit mode, which is immutable after creation). */
  disabled?: boolean
  /** `title` shown on the options that cannot be picked while `disabled` — explains why. */
  disabledTitle?: string
  /** Draws the group in the error colour. Pair with an error message underneath. */
  invalid?: boolean
}

/**
 * Segmented control rendered as an ARIA radio group — the shape both single-choice enums on this
 * form use (product type and product format). One implementation instead of two nearly identical
 * button strips: they differ only in their option list, and letting them drift apart visually
 * would read as two unrelated controls sitting one under the other.
 *
 * The strip WRAPS (`flex-wrap`) rather than scrolling: at 375px "Индивидуальный / Групповой /
 * Оба" does not fit on one line, and a horizontally scrolling segmented control hides options
 * with no affordance that they exist.
 */
export function SegmentedRadio<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  disabledTitle,
  invalid = false,
}: SegmentedRadioProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-invalid={invalid || undefined}
      className={`inline-flex flex-wrap gap-1 rounded-xl border p-1 ${
        invalid ? 'border-rose-500 bg-rose-50' : 'border-neutral-200 bg-neutral-100'
      } ${disabled ? 'opacity-70' : ''}`}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            title={disabled && !selected ? disabledTitle : undefined}
            onClick={() => onChange(option.value)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30 ${
              disabled ? 'cursor-not-allowed' : 'cursor-pointer'
            } ${
              selected
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-800'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
