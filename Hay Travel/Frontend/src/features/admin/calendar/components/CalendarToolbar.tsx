import { Button, Spinner } from '@/shared/ui'
import { ChevronDownIcon } from '@/shared/ui/icons'
import { useCopy } from '@/shared/i18n/defineCopy'
import { calendarCopy } from '../lib/calendarCopy'

export interface CalendarToolbarProps {
  year: number
  /** 1..12. */
  month: number
  canGoBack: boolean
  canGoForward: boolean
  isLoading: boolean
  onPrev: () => void
  onNext: () => void
  onOpenBulk: () => void
  /** `calendar.Create`. The button is HIDDEN rather than disabled: its only purpose is the action,
   * and there is nothing else in it to read (the panel's own convention — a control that is pure
   * action disappears, a control next to information gets disabled). */
  canCreate: boolean
}

/**
 * Month navigation + the entry point to bulk operations. Presentational: it neither knows nor
 * decides which months exist — the page passes `canGoBack`/`canGoForward` from its own range.
 *
 * Mobile: two rows below `sm` (month nav, then the actions), with «Массовые операции» full-width.
 * The nav buttons are 44px squares at every width. «Сегодня» removed (2026-08-14, on request) —
 * jumping back to the current month didn't earn its place next to the one action the admin
 * actually reaches for here.
 */
export function CalendarToolbar({
  year,
  month,
  canGoBack,
  canGoForward,
  isLoading,
  onPrev,
  onNext,
  onOpenBulk,
  canCreate,
}: CalendarToolbarProps) {
  const copy = useCopy(calendarCopy)

  const navButtonClasses =
    'flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent'

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-1">
        {/* Disabled at the range edge rather than hidden: a button that vanishes moves everything
            next to it, and the admin loses the mental model of where the range ends. */}
        <button
          type="button"
          onClick={onPrev}
          disabled={!canGoBack}
          aria-label={copy.prevMonth}
          className={navButtonClasses}
        >
          <ChevronDownIcon size={16} className="rotate-90" />
        </button>

        {/* `aria-live`: paging with the arrows changes only this text, so it has to be announced. */}
        <p
          aria-live="polite"
          className="flex min-w-0 flex-1 items-center gap-2 px-1 text-base font-bold text-neutral-900 sm:min-w-[190px] sm:flex-none"
        >
          <span className="truncate">
            {copy.months[month - 1]} {year}
          </span>
          {/* Sits NEXT TO the heading, never in place of the grid: paging onto an unloaded month
              must not blank a screen the admin is reading. */}
          {isLoading && <Spinner size="sm" className="shrink-0 text-neutral-400" />}
        </p>

        <button
          type="button"
          onClick={onNext}
          disabled={!canGoForward}
          aria-label={copy.nextMonth}
          className={navButtonClasses}
        >
          <ChevronDownIcon size={16} className="-rotate-90" />
        </button>
      </div>

      {canCreate && (
        <Button type="button" size="sm" onClick={onOpenBulk} className="min-h-11 w-full sm:w-auto">
          {copy.bulk}
        </Button>
      )}
    </div>
  )
}
