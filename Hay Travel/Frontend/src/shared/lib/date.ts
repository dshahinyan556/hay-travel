/**
 * Calendar-date helpers, in LOCAL time throughout.
 *
 * Extracted from `shared/ui/DatePicker` when `BookingCard` needed the same "today + 3 months"
 * arithmetic for the picker's `max` bound. Two of these carry a trap that is easy to reproduce
 * wrongly by hand, which is the whole reason they are shared rather than re-written per call site:
 * `formatISODate` avoids `toISOString`'s UTC off-by-one, and `addMonths` clamps the day-of-month.
 *
 * The grid helpers (`isBeforeDay`, `isAfterDay`, `isSameDay`, `addDays`, `startOfMonth`,
 * `endOfMonth`, `mondayFirstWeekday`, `getMonthGrid`) used to be private to `DatePicker`. They are
 * shared as of the admin availability calendar (spec 003): that screen draws the SAME Monday-first
 * 42-cell month grid, and two independent implementations of a calendar grid in one application is
 * exactly the kind of divergence nobody notices until a week starts on the wrong day in one of
 * them. `DatePicker`'s behaviour is unchanged — only where the functions live.
 */

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Parses a `YYYY-MM-DD` string with `Date`'s LOCAL-time constructor (`new Date(y, m, d)`), never
 * `new Date(isoString)` or anything UTC-based. `new Date('2026-07-27')` parses as UTC midnight,
 * which local-renders as the 26th in any timezone west of UTC. Also rejects overflow
 * (`2026-02-30`) instead of letting `Date` roll it over to March 2nd.
 */
export function parseISODate(value: string): Date | null {
  const match = ISO_RE.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return date
}

/** Inverse of `parseISODate` — local getters, not `toISOString` (which is UTC). */
export function formatISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Midnight local time on the same calendar day. */
export function stripTime(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Clamps the day-of-month so e.g. 31 Jan + 1 month lands on 28/29 Feb, not 3 Mar. */
export function addMonths(date: Date, delta: number): Date {
  const day = date.getDate()
  const firstOfTarget = new Date(date.getFullYear(), date.getMonth() + delta, 1)
  const daysInTarget = new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth() + 1, 0).getDate()
  return new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth(), Math.min(day, daysInTarget))
}

/* ── Day comparison ─────────────────────────────────────────────────────────────────────────── */

export function isBeforeDay(a: Date, b: Date): boolean {
  return stripTime(a).getTime() < stripTime(b).getTime()
}

export function isAfterDay(a: Date, b: Date): boolean {
  return stripTime(a).getTime() > stripTime(b).getTime()
}

export function isSameDay(a: Date, b: Date): boolean {
  return stripTime(a).getTime() === stripTime(b).getTime()
}

/* ── Month grid ─────────────────────────────────────────────────────────────────────────────── */

export function addDays(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta)
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/** Last calendar day of the month. Day 0 of the NEXT month is the last day of this one. */
export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

/** Monday-first weekday index: 0 = Monday … 6 = Sunday (native `getDay()` is Sunday-first). */
export function mondayFirstWeekday(date: Date): number {
  return (date.getDay() + 6) % 7
}

/** Always 42 cells (6 full weeks) so the grid never resizes between months. */
export function getMonthGrid(viewMonth: Date): Date[] {
  const first = startOfMonth(viewMonth)
  const gridStart = addDays(first, -mondayFirstWeekday(first))
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
}

/** Every day of the inclusive range, ascending. `from > to` yields `[]` rather than throwing —
 * callers build ranges from user input where an inverted pair is a validation concern, not a
 * crash. */
export function eachDayInRange(from: Date, to: Date): Date[] {
  const start = stripTime(from)
  const end = stripTime(to)
  if (start.getTime() > end.getTime()) return []
  const days: Date[] = []
  for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = addDays(cursor, 1)) {
    days.push(cursor)
  }
  return days
}
