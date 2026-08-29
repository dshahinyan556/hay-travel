import { MAX_GUESTS, MIN_GUESTS } from '@/shared/booking'

/**
 * Guest counter — the "− N +" control shared by the tour page's booking form and every row of the
 * cart (spec 008 §8.3).
 *
 * It was extracted from `BookingCard` verbatim rather than rewritten: the `md` size is the same
 * markup that shipped there, pixel for pixel, so promoting it to a primitive cannot regress the
 * page that is in production. The cart needed the identical accessible stepper a second time, and
 * a copy-paste of an accessible control is the copy that goes stale.
 *
 * Clamping lives HERE (`clampGuests`), not at the call sites: a stepper that can emit 0 or 17 is a
 * stepper every consumer has to re-guard.
 *
 * The buttons carry no `aria-live` region of their own — the value they change is rendered right
 * between them, and the surrounding block (the price, which can switch from a number to a sentence
 * at 7 guests) is what needs announcing, so that lives with the caller.
 */
export interface GuestStepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  /** `'md'` — the booking form's size (36px buttons, 12px gaps). `'sm'` — the cart row: same 36px
   * buttons, tighter gaps and a smaller value, with an invisible `before:` expander taking the tap
   * target to the 44×44 minimum. */
  size?: 'md' | 'sm'
  /** Accessible name of the value itself, e.g. "Средних чемоданов". Without it a screen reader
   * reaching the number between the two buttons hears a bare digit. */
  valueLabel?: string
  labelFewer: string
  labelMore: string
  disabled?: boolean
}

export function GuestStepper({
  value,
  onChange,
  min = MIN_GUESTS,
  max = MAX_GUESTS,
  size = 'md',
  valueLabel,
  labelFewer,
  labelMore,
  disabled = false,
}: GuestStepperProps) {
  const compact = size === 'sm'

  /*
    Whole number first (kills a NaN/fractional value from anywhere), then the CALLER's bounds.

    This used to run `clampGuests` before the caller's bounds, which pinned the floor at
    `MIN_GUESTS` (1) no matter what `min` said — so `min={0}`, which the luggage counters of the
    transfer request builder need (2026-08-29), was unreachable. For the default bounds
    (1..16) the two orders are identical, so no existing call site changes behaviour.
  */
  const emit = (next: number) => {
    const whole = Number.isFinite(next) ? Math.trunc(next) : min
    onChange(Math.min(max, Math.max(min, whole)))
  }

  /* The `md` class list is byte-for-byte what `BookingCard` shipped with, minus nothing: no
     `inline-flex` (a button centres its own text), no bound-based `disabled` (pressing "−" at the
     minimum has always been a no-op rather than a dimmed button). Only `focus-visible` was added,
     and it changes nothing at rest. */
  const buttonClass = [
    'h-9 w-9 rounded-full text-lg text-gold-ink ring-1 ring-edge-strong transition-colors hover:bg-accent-soft',
    'focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none',
    'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent',
    // Only the compact size needs the expander: at `md` the control sits in a form with generous
    // spacing, and growing its hit area there would overlap the fields above/below it.
    compact ? "relative before:absolute before:-inset-1 before:content-['']" : '',
  ].join(' ')

  return (
    <div className={`flex items-center ${compact ? 'gap-2.5' : 'gap-3'}`}>
      <button
        type="button"
        onClick={() => emit(value - 1)}
        disabled={disabled}
        aria-label={labelFewer}
        className={buttonClass}
      >
        −
      </button>
      <span
        aria-label={valueLabel}
        className={`text-center font-semibold tabular-nums text-ink ${compact ? 'min-w-7 text-lg' : 'min-w-8 text-xl'}`}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => emit(value + 1)}
        disabled={disabled}
        aria-label={labelMore}
        className={buttonClass}
      >
        +
      </button>
    </div>
  )
}
