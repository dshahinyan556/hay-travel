/**
 * Time formatting for the «Фоновые задачи» screen — the one place on this screen (per the
 * approved mockup §05 "Время") where every timestamp renders in ARMENIA time regardless of the
 * visitor's own timezone or the admin panel's `Locale`, because the audience is Hay Travel's own
 * Yerevan-based staff reading about Yerevan-based tours. The server sends UTC; conversion happens
 * here, nowhere else on the screen. The ONE deliberate exception — the cron schedule editor's
 * "Время запуска (UTC)" field, since the scheduler itself runs on UTC — stays a plain labelled
 * `Input`, not a call into this module.
 *
 * Weekday/month vocabulary is read straight off `Intl` rather than routed through `jobsCopy`,
 * the same precedent `shared/lib/date.ts`'s own `MONTHS_NOMINATIVE`/`WEEKDAYS_FULL` already set
 * for calendar words — this module's `today`/`tomorrow` leads are the one exception (no `Intl`
 * token for those), so they are threaded in as parameters rather than hardcoded here, keeping
 * translation ownership in `jobsCopy.ts` where every other on-screen word lives.
 */

import type { Locale } from '@/shared/lib/locale'

export const YEREVAN_TZ = 'Asia/Yerevan'

/** `YYYY-MM-DD` in Armenia's OWN calendar day — used only to compare two instants' calendar days
 * against each other (today/yesterday/tomorrow), never parsed back into a `Date` for arithmetic
 * beyond that comparison. `en-CA` is the one `Intl` locale that reliably formats as ISO order. */
function yerevanDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: YEREVAN_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** Whole Armenia calendar days between `from` and `date` (positive = `date` is later). Computed
 * off the `YYYY-MM-DD` keys (parsed as UTC midnight, so DST — Armenia has none — cannot skew it),
 * not off a raw millisecond difference, which a same-day-but-near-midnight pair would round
 * wrongly. */
function yerevanDayOffset(date: Date, from: Date): number {
  const a = Date.parse(`${yerevanDateKey(from)}T00:00:00Z`)
  const b = Date.parse(`${yerevanDateKey(date)}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

const DATE_TIME_FORMATTERS: Record<Locale, Intl.DateTimeFormat> = {
  ru: new Intl.DateTimeFormat('ru-RU', {
    timeZone: YEREVAN_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }),
  en: new Intl.DateTimeFormat('en-GB', {
    timeZone: YEREVAN_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }),
}

/** `29.08.2026, 19:00`, Armenia time — full timestamp for a history/report row. */
export function formatYerevanDateTime(iso: string, locale: Locale): string {
  return DATE_TIME_FORMATTERS[locale].format(new Date(iso))
}

const CLOCK_FORMATTERS: Record<Locale, Intl.DateTimeFormat> = {
  ru: new Intl.DateTimeFormat('ru-RU', { timeZone: YEREVAN_TZ, hour: '2-digit', minute: '2-digit', hour12: false }),
  en: new Intl.DateTimeFormat('en-GB', { timeZone: YEREVAN_TZ, hour: '2-digit', minute: '2-digit', hour12: false }),
}

const SHORT_DATE_FORMATTERS: Record<Locale, Intl.DateTimeFormat> = {
  ru: new Intl.DateTimeFormat('ru-RU', { timeZone: YEREVAN_TZ, day: '2-digit', month: '2-digit' }),
  en: new Intl.DateTimeFormat('en-GB', { timeZone: YEREVAN_TZ, day: '2-digit', month: '2-digit' }),
}

const DAY_MONTH_FORMATTERS: Record<Locale, Intl.DateTimeFormat> = {
  ru: new Intl.DateTimeFormat('ru-RU', { timeZone: YEREVAN_TZ, day: 'numeric', month: 'long' }),
  en: new Intl.DateTimeFormat('en-GB', { timeZone: YEREVAN_TZ, day: 'numeric', month: 'long' }),
}

const WEEKDAY_FORMATTERS: Record<Locale, Intl.DateTimeFormat> = {
  ru: new Intl.DateTimeFormat('ru-RU', { timeZone: YEREVAN_TZ, weekday: 'long' }),
  en: new Intl.DateTimeFormat('en-GB', { timeZone: YEREVAN_TZ, weekday: 'long' }),
}

/**
 * `сегодня, 19:30` / `вчера, 03:00` / `29.08, 19:00` — the job LIST row's compact "last run"
 * timestamp (mockup §02). Falls back to a plain short date once the run is more than a day old,
 * so the row never has to decide between a wrong "вчера" and a stale-looking blank.
 */
export function formatYerevanRelativeShort(iso: string, locale: Locale, today: string, yesterday: string, now: Date = new Date()): string {
  const date = new Date(iso)
  const offset = yerevanDayOffset(date, now)
  const time = CLOCK_FORMATTERS[locale].format(date)
  if (offset === 0) return `${today}, ${time}`
  if (offset === -1) return `${yesterday}, ${time}`
  return `${SHORT_DATE_FORMATTERS[locale].format(date)}, ${time}`
}

/**
 * `сегодня, 29 августа, 20:00` / `завтра, 30 августа, 07:00` / `воскресенье, 31 августа, 07:00`
 * — the schedule card's next-run summary and its "Ближайшие запуски" preview list (mockup §05/06).
 * Beyond tomorrow the lead word is the Armenia weekday name (`Intl`, already localised — no third
 * calendar-word parameter needed for that branch).
 */
export function formatYerevanUpcoming(date: Date, locale: Locale, today: string, tomorrow: string, now: Date = new Date()): string {
  const offset = yerevanDayOffset(date, now)
  const lead = offset === 0 ? today : offset === 1 ? tomorrow : WEEKDAY_FORMATTERS[locale].format(date)
  return `${lead}, ${DAY_MONTH_FORMATTERS[locale].format(date)}, ${CLOCK_FORMATTERS[locale].format(date)}`
}

/** `19:00` — Armenia clock only, for the run-report page's start/end/summary-panel rows, which
 * already carry the date in their own label ("Начало"/"Окончание") and would be noise repeated. */
export function formatYerevanClock(iso: string, locale: Locale): string {
  return CLOCK_FORMATTERS[locale].format(new Date(iso))
}

/** Whole minutes from `now` to `iso`, rounded down, floored at 0 — a next-run timestamp in the
 * past (clock skew between server and this tab, or the preview rendered mid-tick) reads as "через
 * 0 минут" rather than a confusing negative number. */
export function minutesUntil(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - now.getTime()) / 60_000))
}

const DURATION_NUMBER: Record<Locale, Intl.NumberFormat> = {
  ru: new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  en: new Intl.NumberFormat('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
}

/** `0,4 с` / `30,0 с` (`en`: `0.4s` / `30.0s`) — one decimal place, matching the mockup's summary
 * rows exactly. `null` while the run has no `finishedAtUtc` yet (still `Running`) — the caller
 * decides what to show instead (a dash, or nothing, per context). */
export function formatDurationSeconds(startIso: string, endIso: string | null, locale: Locale): string | null {
  if (endIso === null) return null
  const seconds = (new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000
  const unit = locale === 'en' ? 's' : 'с'
  return `${DURATION_NUMBER[locale].format(Math.max(0, seconds))} ${unit}`
}
