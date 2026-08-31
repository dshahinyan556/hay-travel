/**
 * Calendar-date helpers, in LOCAL time throughout — with one clearly fenced exception at the bottom
 * of the file (`parseUtcTimestamp`/`formatUtcDateTime`, which turn the API's UTC instants into
 * something a visitor can read).
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

import type { Locale } from '@/shared/lib/locale'

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

/* ── Month and weekday names ────────────────────────────────────────────────────────────────── */

/*
 * Written out rather than taken from `Intl.DateTimeFormat`: the Russian calendar needs BOTH the
 * nominative ("Август 2026") and the genitive ("12 августа 2026") form of a month name, and `Intl`
 * gives only one of them per locale. They live here, next to the grid helpers, because two screens
 * need the same lists — `shared/ui/DatePicker` and the admin availability calendar — and two
 * hand-kept copies of twelve month names is how one of them ends up a month behind the other.
 *
 * Weekday lists are MONDAY-FIRST, matching `mondayFirstWeekday`/`getMonthGrid` above. A caller
 * that keys by `System.DayOfWeek` (Sunday = 0) converts with `(code + 6) % 7`.
 */

export const MONTHS_NOMINATIVE: Record<Locale, string[]> = {
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}

/** Genitive case for `ru` — "27 июля", not "27 Июль". English has no genitive case, so `en`
 * reuses the nominative list. */
export const MONTHS_GENITIVE: Record<Locale, string[]> = {
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  en: MONTHS_NOMINATIVE.en,
}

export const WEEKDAYS_SHORT: Record<Locale, string[]> = {
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
}

export const WEEKDAYS_FULL: Record<Locale, string[]> = {
  ru: ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'],
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
}

/* ── UTC instants from the API ──────────────────────────────────────────────────────────────── */

/*
 * The exception to this module's "local time throughout" rule, and the reason it is fenced off in
 * its own section: everything above works with a CALENDAR DAY the visitor picked, while the two
 * helpers below work with an INSTANT the server recorded (`*AtUtc` columns — login history, session
 * creation/expiry). Those are different kinds of value and must not be mixed up.
 */

/**
 * Parse an `*AtUtc` string from the API into a `Date`, or `null` when it is unparseable.
 *
 * The column is UTC but the value may arrive WITHOUT a zone designator, in which case `new Date()`
 * reads it as LOCAL time and silently shifts the moment by the visitor's offset — three hours for
 * Yerevan, and the wrong day either side of midnight. Appending `Z` when there is neither a `Z` nor
 * an explicit offset is what keeps that honest.
 *
 * Shared rather than re-derived per call site: the check is easy to write ALMOST right (a bare
 * `endsWith('Z')` misses `+04:00`), and three lists now depend on it.
 */
export function parseUtcTimestamp(value: string): Date | null {
  const normalised = /(?:[Zz]|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`
  const date = new Date(normalised)
  return Number.isNaN(date.getTime()) ? null : date
}

/** One formatter per interface locale, built once — `Intl.DateTimeFormat` is expensive to
 * construct and these lists format a row each. `en-GB` per Spec 009 §5 (day-month-year). */
const UTC_DATE_TIME: Record<Locale, Intl.DateTimeFormat> = {
  ru: new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }),
  en: new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }),
}

/**
 * An `*AtUtc` instant rendered in the VISITOR's timezone and locale ("29 авг. 2026 г., 18:42").
 *
 * Unparseable input degrades to the raw string: a list row showing an odd timestamp is better than
 * one showing «Invalid Date», and better than a crash inside a list.
 */
export function formatUtcDateTime(value: string, locale: Locale): string {
  const date = parseUtcTimestamp(value)
  return date === null ? value : UTC_DATE_TIME[locale].format(date)
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
