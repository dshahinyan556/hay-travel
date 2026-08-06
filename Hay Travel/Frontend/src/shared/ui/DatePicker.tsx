import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useFocusTrap, useIsCompactViewport } from '@/shared/hooks'
import { addMonths, formatISODate, parseISODate, stripTime } from '@/shared/lib/date'
import type { Locale } from '@/shared/lib/locale'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { Popover } from './Popover'
import { Sheet, SHEET_SINGLE_DETENT } from './Sheet'
import { ChevronDownIcon } from './icons'

const MONTHS_NOMINATIVE: Record<Locale, string[]> = {
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}
/** Genitive case for `ru` — "27 июля", not "27 Июль" — for the trigger's formatted display.
 * English has no genitive case, so `en` reuses the nominative list. */
const MONTHS_GENITIVE: Record<Locale, string[]> = {
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  en: MONTHS_NOMINATIVE.en,
}
const WEEKDAYS_SHORT: Record<Locale, string[]> = {
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
}
const WEEKDAYS_FULL: Record<Locale, string[]> = {
  ru: ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'],
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
}

/* `parseISODate`/`formatISODate`/`stripTime`/`addMonths` moved to `shared/lib/date` so `BookingCard`
   can compute the 3-month booking window with the same day-of-month clamp and the same
   local-time-not-UTC formatting. The helpers below stay private: only this grid needs them. */

function isBeforeDay(a: Date, b: Date): boolean {
  return stripTime(a).getTime() < stripTime(b).getTime()
}
function isAfterDay(a: Date, b: Date): boolean {
  return stripTime(a).getTime() > stripTime(b).getTime()
}
function isSameDay(a: Date, b: Date): boolean {
  return stripTime(a).getTime() === stripTime(b).getTime()
}
function addDays(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta)
}
function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}
/** Monday-first weekday index: 0 = Monday … 6 = Sunday (native `getDay()` is Sunday-first). */
function mondayFirstWeekday(date: Date): number {
  return (date.getDay() + 6) % 7
}

/**
 * Resolves the text content of the element `aria-labelledby` points to — see `Select`'s identical
 * helper for why (the trigger's own accessible name is already handled by forwarding
 * `aria-labelledby` straight through as a DOM attribute; this is only for the mobile sheet's
 * `ariaLabel` prop/heading and the desktop dialog's `aria-label`, both of which need a string).
 */
function useLabelledByText(id: string | undefined): string | undefined {
  const [text, setText] = useState<string | undefined>(() =>
    id ? (document.getElementById(id)?.textContent ?? undefined) : undefined,
  )
  useEffect(() => {
    setText(id ? (document.getElementById(id)?.textContent ?? undefined) : undefined)
  }, [id])
  return text
}

/** Always 42 cells (6 full weeks) so the grid never resizes between months. */
function getMonthGrid(viewMonth: Date): Date[] {
  const first = startOfMonth(viewMonth)
  const gridStart = addDays(first, -mondayFirstWeekday(first))
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
}

function formatDisplay(date: Date, locale: Locale): string {
  return `${date.getDate()} ${MONTHS_GENITIVE[locale][date.getMonth()]} ${date.getFullYear()}`
}

export interface DatePickerProps {
  id?: string
  /** ISO `YYYY-MM-DD`, or `''` for no selection — the same shape as `<input type="date">`. */
  value: string
  onChange: (value: string) => void
  /** ISO `YYYY-MM-DD` lower bound (inclusive). */
  min?: string
  /** ISO `YYYY-MM-DD` upper bound (inclusive). */
  max?: string
  /**
   * Disable every day before today. A flag, not hardcoded behaviour: it defaults to `true` because
   * that is what the one call site today ("Дата выезда") needs, but a future field wanting the
   * opposite (e.g. a date of birth) can pass `false`.
   */
  disablePast?: boolean
  placeholder?: string
  disabled?: boolean
  /** Marks the field as invalid: red border. Pair with `Field`'s `error` text. */
  error?: boolean
  /**
   * Advisory only: sets `aria-required` for assistive tech. The trigger is a `<button>`, not a
   * native form control, so nothing here blocks form submission — a native `<input required>`
   * would stop `<form>` submit on its own, this does not. A call site that must enforce "a date
   * is required" (e.g. `BookingCard`) has to check `value === ''` itself on submit; do not assume
   * this prop does that for you.
   */
  required?: boolean
  /** Extra classes for the outer positioning wrapper (e.g. a margin like `mt-1.5`). */
  className?: string
  /**
   * Overrides the trigger's shape and spacing — border-radius, padding (`rounded-lg px-3 py-2` by
   * default). See the identical prop on `Select` for why this REPLACES the default shape instead
   * of appending to it. Colors and the 44px minimum tap target are never affected by this prop.
   */
  triggerClassName?: string
  /** See the identical prop on `Select` — same reasoning, same two literal palettes. */
  surface?: 'public' | 'admin'
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
}

/**
 * Custom single-date picker, replacing `<input type="date">` (native calendar drawn by the OS —
 * see `docs/audit/bugs-2026-07-27.md` §3.2). Monday-first, Russian month/weekday names, no date
 * library: the grid is 42 cells of plain `Date` arithmetic, always in local time (see
 * `parseISODate`'s doc comment for the UTC trap this avoids).
 *
 * Unlike `Select`, both viewports use the SAME interaction model — the APG "Date Picker Dialog"
 * pattern: opening it moves real focus onto a day cell, and arrow keys move that focus (roving
 * tabindex: only one day has `tabIndex=0` at a time), rather than a combobox's
 * `aria-activedescendant`. That is also why focus-trapping differs by viewport: on desktop the
 * calendar is its own `role="dialog"` inside `Popover` (which does not trap focus itself — see
 * its doc comment) and wires `useFocusTrap` directly; inside the mobile `Sheet`, that sheet
 * already traps focus over its whole surface, so a second nested trap here would fight it, and is
 * skipped.
 *
 * Disabled days (past dates, or outside `min`/`max`) stay focusable and reachable by arrow keys —
 * only `aria-disabled` and a no-op click/Enter — because a genuinely `disabled` button cannot
 * receive focus, which would break arrow-key roving across a disabled stretch (e.g. every day
 * before today).
 */
export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  disablePast = true,
  placeholder,
  disabled = false,
  error = false,
  required,
  className = '',
  triggerClassName,
  surface = 'public',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
}: DatePickerProps) {
  const generatedId = useId()
  const controlId = id ?? generatedId
  const { locale, t } = useLocale()
  const resolvedPlaceholder = placeholder ?? t('datePicker.placeholder')

  const isCompact = useIsCompactViewport()
  const today = stripTime(new Date())

  // Memoized on the ISO *string*, not just computed inline: `parseISODate` builds a new `Date`
  // object every call, and without this, `isDisabledDate` below would see a new `minDate`/
  // `maxDate` reference — and so recreate itself — on every render even when `min`/`max` haven't
  // actually changed.
  const minDate = useMemo(() => (min ? parseISODate(min) : null), [min])
  const maxDate = useMemo(() => (max ? parseISODate(max) : null), [max])
  const selectedDate = useMemo(() => (value ? parseISODate(value) : null), [value])

  const isDisabledDate = useCallback(
    (date: Date) => {
      if (disablePast && isBeforeDay(date, today)) return true
      if (minDate && isBeforeDay(date, minDate)) return true
      if (maxDate && isAfterDay(date, maxDate)) return true
      return false
    },
    // `today` (below) is a `new Date()` snapshot taken fresh every render and deliberately left
    // out here: it never usefully changes within a session, and including it would defeat the
    // memoization above by recreating this callback on every render anyway.
    [disablePast, minDate, maxDate],
  )

  const initialFocusDate = selectedDate && !isDisabledDate(selectedDate) ? selectedDate : today

  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(initialFocusDate))
  const [focusedDate, setFocusedDate] = useState(initialFocusDate)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const dayRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  useFocusTrap(dialogRef, open && !isCompact)

  const close = useCallback(() => setOpen(false), [])

  const openPicker = useCallback(() => {
    if (disabled) return
    const start = selectedDate && !isDisabledDate(selectedDate) ? selectedDate : today
    setViewMonth(startOfMonth(start))
    setFocusedDate(start)
    setOpen(true)
  }, [disabled, selectedDate, isDisabledDate])

  const commit = useCallback(
    (date: Date) => {
      if (isDisabledDate(date)) return
      onChange(formatISODate(date))
      setOpen(false)
      triggerRef.current?.focus()
    },
    [isDisabledDate, onChange],
  )

  // Keeps the roving-tabindex day cell actually focused after keyboard navigation moves it,
  // including across a month change (the target cell only exists once the new grid renders).
  useEffect(() => {
    if (!open) return
    dayRefs.current.get(formatISODate(focusedDate))?.focus()
  }, [open, focusedDate, viewMonth])

  const moveFocus = useCallback((next: Date) => {
    setFocusedDate(next)
    setViewMonth((current) => (current.getMonth() === next.getMonth() && current.getFullYear() === next.getFullYear() ? current : startOfMonth(next)))
  }, [])

  function handleDayKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, date: Date) {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        moveFocus(addDays(date, 1))
        return
      case 'ArrowLeft':
        event.preventDefault()
        moveFocus(addDays(date, -1))
        return
      case 'ArrowDown':
        event.preventDefault()
        moveFocus(addDays(date, 7))
        return
      case 'ArrowUp':
        event.preventDefault()
        moveFocus(addDays(date, -7))
        return
      case 'Home':
        event.preventDefault()
        moveFocus(addDays(date, -mondayFirstWeekday(date)))
        return
      case 'End':
        event.preventDefault()
        moveFocus(addDays(date, 6 - mondayFirstWeekday(date)))
        return
      case 'PageUp':
        event.preventDefault()
        moveFocus(addMonths(date, event.shiftKey ? -12 : -1))
        return
      case 'PageDown':
        event.preventDefault()
        moveFocus(addMonths(date, event.shiftKey ? 12 : 1))
        return
      case 'Enter':
      case ' ':
        event.preventDefault()
        commit(date)
        return
      default:
    }
  }

  const labelledByText = useLabelledByText(ariaLabelledBy)
  const dialogLabel = labelledByText ?? ariaLabel ?? resolvedPlaceholder
  const grid = getMonthGrid(viewMonth)
  const weeks = Array.from({ length: 6 }, (_, week) => grid.slice(week * 7, week * 7 + 7))

  const isAdmin = surface === 'admin'
  const mutedTextClass = isAdmin ? 'text-neutral-400' : 'text-ink-muted'

  // Shape/spacing vs. color, kept as two separate groups for the same reason as `Select`'s
  // identical split — see that file's `triggerClassName` doc comment.
  const DEFAULT_TRIGGER_SHAPE = 'rounded-lg px-3 py-2'
  const TRIGGER_BASE = 'relative flex w-full items-center gap-2 min-h-11 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed'
  const triggerColorClasses = isAdmin
    ? `border bg-white text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-400 ${
        error
          ? 'border-rose-500 focus-visible:border-rose-600 focus-visible:ring-rose-600/20'
          : 'border-neutral-300 hover:border-neutral-400 focus-visible:border-brand-600 focus-visible:ring-brand-600/20'
      }`
    : `border bg-panel-raised text-ink disabled:border-disabled-edge disabled:bg-disabled-bg disabled:text-disabled-ink ${
        error ? 'border-danger focus-visible:ring-danger' : 'border-edge-strong hover:border-gold-line focus-visible:ring-focus'
      }`
  const triggerClasses = `${TRIGGER_BASE} ${triggerClassName || DEFAULT_TRIGGER_SHAPE} ${triggerColorClasses}`

  // Chrome (border/bg/shadow) only — padding is separate below so it still applies on the mobile
  // sheet, which skips this chrome (the sheet itself already draws a panel) but must not skip the
  // breathing room around the grid.
  const panelChromeClasses = isAdmin
    ? 'rounded-lg border border-neutral-200 bg-white shadow-lg'
    : 'rounded-lg border border-edge-strong bg-panel-raised shadow-lg'

  // 44px (`h-11`/`w-11`) is this project's minimum tap target — applies here too, not just to
  // form controls, so both the nav buttons and every day cell use it.
  const navButtonClasses = isAdmin
    ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30'
    : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus'

  function dayClasses(date: Date, dayDisabled: boolean): string {
    const inMonth = date.getMonth() === viewMonth.getMonth()
    const selected = selectedDate ? isSameDay(date, selectedDate) : false
    const isToday = isSameDay(date, today)
    // `mx-auto`: the grid's columns are `1fr` (so the weekday header text, which has no fixed
    // width, centers itself across the same 7 equal columns) — a fixed 44px button would
    // otherwise sit flush at a column's start instead of centered in it.
    const base = 'mx-auto flex h-11 w-11 items-center justify-center rounded-full text-sm transition-colors focus-visible:outline-none focus-visible:ring-2'
    if (dayDisabled) {
      return `${base} cursor-not-allowed ${isAdmin ? 'text-neutral-300' : 'text-ink-muted opacity-50'}`
    }
    if (isAdmin) {
      return `${base} cursor-pointer focus-visible:ring-brand-600/40 ${
        selected
          ? 'bg-brand-700 font-semibold text-white'
          : isToday
            ? `font-semibold text-brand-700 ${inMonth ? '' : 'opacity-50'} hover:bg-brand-50`
            : `text-neutral-900 hover:bg-neutral-100 ${inMonth ? '' : 'opacity-50'}`
      }`
    }
    return `${base} cursor-pointer focus-visible:ring-focus ${
      selected
        ? 'bg-gold-fill font-semibold text-gold-on'
        : isToday
          ? `font-semibold text-gold-ink ${inMonth ? '' : 'opacity-50'} hover:bg-accent-soft`
          : `text-ink hover:bg-accent-soft ${inMonth ? '' : 'opacity-50'}`
    }`
  }

  const calendarBody = (
    // Width fits exactly seven 44px columns plus their `gap-1` (7*44 + 6*4 = 332px of grid) and
    // the panel's own padding — recompute both together if either changes.
    <div className={`w-[23rem] max-w-full p-3 ${isCompact ? '' : panelChromeClasses}`}>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => moveFocus(addMonths(focusedDate, -1))}
          aria-label={t('datePicker.prevMonth')}
          className={navButtonClasses}
        >
          <ChevronDownIcon size={16} className="rotate-90" />
        </button>
        <p aria-live="polite" className={`font-display text-base ${isAdmin ? 'text-neutral-900' : 'text-ink'}`}>
          {MONTHS_NOMINATIVE[locale][viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </p>
        <button
          type="button"
          onClick={() => moveFocus(addMonths(focusedDate, 1))}
          aria-label={t('datePicker.nextMonth')}
          className={navButtonClasses}
        >
          <ChevronDownIcon size={16} className="-rotate-90" />
        </button>
      </div>

      <div aria-hidden="true" className={`mt-3 grid grid-cols-7 gap-1 text-center text-xs ${isAdmin ? 'text-neutral-400' : 'text-ink-muted'}`}>
        {WEEKDAYS_SHORT[locale].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="mt-1 flex flex-col gap-1">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 gap-1">
            {week.map((date) => {
              const key = formatISODate(date)
              const dayDisabled = isDisabledDate(date)
              const isFocusTarget = isSameDay(date, focusedDate)
              return (
                <button
                  key={key}
                  ref={(node) => {
                    if (node) dayRefs.current.set(key, node)
                    else dayRefs.current.delete(key)
                  }}
                  type="button"
                  tabIndex={isFocusTarget ? 0 : -1}
                  aria-pressed={selectedDate ? isSameDay(date, selectedDate) : false}
                  aria-current={isSameDay(date, today) ? 'date' : undefined}
                  aria-disabled={dayDisabled || undefined}
                  aria-label={`${date.getDate()} ${MONTHS_GENITIVE[locale][date.getMonth()]} ${date.getFullYear()}, ${WEEKDAYS_FULL[locale][mondayFirstWeekday(date)]}`}
                  onClick={() => commit(date)}
                  onKeyDown={(event) => handleDayKeyDown(event, date)}
                  onFocus={() => setFocusedDate(date)}
                  className={dayClasses(date, dayDisabled)}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        id={controlId}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={error || undefined}
        aria-required={required || undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPicker())}
        className={triggerClasses}
      >
        <span className={`flex-1 truncate ${selectedDate ? '' : mutedTextClass}`}>
          {selectedDate ? formatDisplay(selectedDate, locale) : resolvedPlaceholder}
        </span>
        <span aria-hidden="true" className={`shrink-0 ${mutedTextClass}`}>
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
            <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" />
          </svg>
        </span>
      </button>

      {isCompact ? (
        <Sheet open={open} onClose={close} ariaLabel={dialogLabel} detents={SHEET_SINGLE_DETENT}>
          <div className={`px-1 pb-2 pt-1 text-sm font-semibold ${isAdmin ? 'text-neutral-900' : 'text-ink'}`}>
            {dialogLabel}
          </div>
          <div className="flex justify-center">{calendarBody}</div>
        </Sheet>
      ) : (
        <Popover open={open} onClose={close} anchorRef={triggerRef}>
          <div ref={dialogRef} role="dialog" aria-label={dialogLabel} tabIndex={-1} className="outline-none">
            {calendarBody}
          </div>
        </Popover>
      )}
    </div>
  )
}
