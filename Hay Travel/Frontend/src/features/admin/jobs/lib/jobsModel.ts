/**
 * Pure helpers for the «Фоновые задачи» screen — cron presets, next-occurrence preview and the
 * client-side draft-vs-baseline logic. No copy, no React: this module is imported by both the
 * page (`JobDetailPage`) and its components, and by nothing outside `features/admin/jobs`.
 */

import { LanguageCode, TourTranslationType } from '@/features/admin/lib/enums'
import { LANGUAGE_CODE_BY_LOCALE, type Locale } from '@/shared/lib/locale'
import type { TourInfoModel } from '@/shared/types/attours'
import { JobRunStatus } from '@/features/admin/types/jobs'
import type { JobsCopy } from './jobsCopy'

/* ── Badge tone (§04/§11 of the mockup) ─────────────────────────────────────────────────────
 * Colour is spent on exactly one thing — failure. Everything else is weight/fill, never a hue.
 * A status number this bundle does not recognise renders `'unknown'` — a neutral grey badge that
 * shows the raw number — rather than guessing or crashing (mockup §04's "one lookup table").
 */
export type JobStatusTone = 'ok' | 'skip' | 'fail' | 'run' | 'unknown'

export function jobStatusTone(status: number): JobStatusTone {
  switch (status) {
    case JobRunStatus.Running:
      return 'run'
    case JobRunStatus.Succeeded:
      return 'ok'
    case JobRunStatus.Skipped:
      return 'skip'
    case JobRunStatus.Failed:
      return 'fail'
    default:
      return 'unknown'
  }
}

/* ── Cron presets ────────────────────────────────────────────────────────────────────────────
 * The catalogue from the mockup's §6 hand-off: every N minutes, hourly, every N hours, daily at
 * HH:MM, weekly on a day at HH:MM, or a free-form expression. `presetToCron`/`cronToPreset` are
 * exact inverses for anything THIS module generated; a cron string that came from elsewhere
 * (hand-typed, or a shape this catalogue doesn't cover) round-trips as `custom` — never guessed
 * into the wrong preset.
 */
export type CronPreset =
  | { kind: 'everyNMinutes'; n: number }
  | { kind: 'hourly' }
  | { kind: 'everyNHours'; n: number }
  | { kind: 'dailyAt'; hourUtc: number; minuteUtc: number }
  | { kind: 'weeklyAt'; dayOfWeek: number; hourUtc: number; minuteUtc: number }
  | { kind: 'custom'; expression: string }

export const MINUTE_PRESET_OPTIONS = [5, 10, 15, 30]
export const HOUR_PRESET_OPTIONS = [2, 3, 4, 6, 12]

export function presetToCron(preset: CronPreset): string {
  switch (preset.kind) {
    case 'everyNMinutes':
      return `*/${preset.n} * * * *`
    case 'hourly':
      return '0 * * * *'
    case 'everyNHours':
      return `0 */${preset.n} * * *`
    case 'dailyAt':
      return `${preset.minuteUtc} ${preset.hourUtc} * * *`
    case 'weeklyAt':
      return `${preset.minuteUtc} ${preset.hourUtc} * * ${preset.dayOfWeek}`
    case 'custom':
      return preset.expression
  }
}

const EVERY_N_MINUTES_RE = /^\*\/(\d{1,2}) \* \* \* \*$/
const HOURLY_RE = /^0 \* \* \* \*$/
const EVERY_N_HOURS_RE = /^0 \*\/(\d{1,2}) \* \* \*$/
const DAILY_AT_RE = /^(\d{1,2}) (\d{1,2}) \* \* \*$/
const WEEKLY_AT_RE = /^(\d{1,2}) (\d{1,2}) \* \* (\d)$/

export function cronToPreset(cron: string): CronPreset {
  const expression = cron.trim()

  let match = EVERY_N_MINUTES_RE.exec(expression)
  if (match) return { kind: 'everyNMinutes', n: Number(match[1]) }

  if (HOURLY_RE.test(expression)) return { kind: 'hourly' }

  match = EVERY_N_HOURS_RE.exec(expression)
  if (match) return { kind: 'everyNHours', n: Number(match[1]) }

  // Weekly must be tried before daily — both match `M H * * *`-shaped text, but weekly's last
  // field is a day-of-week (0–6) rather than `*`, so the daily regex would otherwise never fire
  // for a genuinely daily cron (it has no 5th capture group to confuse it with) — order here is
  // what keeps the two from stepping on each other.
  match = WEEKLY_AT_RE.exec(expression)
  if (match) {
    return { kind: 'weeklyAt', minuteUtc: Number(match[1]), hourUtc: Number(match[2]), dayOfWeek: Number(match[3]) }
  }

  match = DAILY_AT_RE.exec(expression)
  if (match) return { kind: 'dailyAt', minuteUtc: Number(match[1]), hourUtc: Number(match[2]) }

  return { kind: 'custom', expression }
}

/* ── Cron validation & next-occurrence preview ──────────────────────────────────────────────
 * Own parser, no external library (mockup §6/§11: "Разбор cron — своя функция ... без внешней
 * библиотеки"). Standard 5-field cron only (minute hour day-of-month month day-of-week) — the
 * 6-field seconds format the backend also accepts (`Cronos`, `CronFormat.IncludeSeconds`) is
 * left to the server's own validation on save; no preset here ever generates one, and a
 * hand-typed 6-field expression still SAVES correctly (the backend parses it), it just does not
 * get a live "next 3 runs" preview — degrading to no preview beats re-implementing a second cron
 * parser for an edge case nobody's preset produces.
 */

const FIELD_BOUNDS: Record<'minute' | 'hour' | 'day' | 'month' | 'weekday', [number, number]> = {
  minute: [0, 59],
  hour: [0, 23],
  day: [1, 31],
  month: [1, 12],
  weekday: [0, 7], // Cron allows both 0 and 7 for Sunday.
}

// One comma-separated cron field: `*`, `5`, `1-5`, a step like every-15 or 1-10 stepped by 2, or
// a comma list of those. (Kept as a `//` comment, not `/**…*/`, so a literal step example inside
// it cannot prematurely close a block comment.)
function parseFieldValues(raw: string, bounds: [number, number]): Set<number> | null {
  const [min, max] = bounds
  const values = new Set<number>()

  for (const part of raw.split(',')) {
    const stepMatch = /^([^/]+)(?:\/(\d+))$/.exec(part)
    const base = stepMatch ? stepMatch[1] : part
    const step = stepMatch ? Number(stepMatch[2]) : 1
    if (step <= 0) return null

    let rangeStart = min
    let rangeEnd = max
    if (base !== '*') {
      const rangeMatch = /^(\d+)(?:-(\d+))?$/.exec(base)
      if (!rangeMatch) return null
      rangeStart = Number(rangeMatch[1])
      rangeEnd = rangeMatch[2] !== undefined ? Number(rangeMatch[2]) : rangeStart
      if (rangeStart < min || rangeEnd > max || rangeStart > rangeEnd) return null
    }

    for (let v = rangeStart; v <= rangeEnd; v += step) values.add(v)
  }

  return values
}

interface ParsedCron {
  minute: Set<number>
  hour: Set<number>
  day: Set<number>
  month: Set<number>
  weekday: Set<number>
}

/** `null` for anything this parser cannot make sense of — 6-field expressions included (they are
 * still valid cron, just outside this preview's scope, see the section doc comment above). */
function parseCron(expression: string): ParsedCron | null {
  const fields = expression.trim().split(/\s+/)
  if (fields.length !== 5) return null

  const minute = parseFieldValues(fields[0], FIELD_BOUNDS.minute)
  const hour = parseFieldValues(fields[1], FIELD_BOUNDS.hour)
  const day = parseFieldValues(fields[2], FIELD_BOUNDS.day)
  const month = parseFieldValues(fields[3], FIELD_BOUNDS.month)
  const weekdayRaw = parseFieldValues(fields[4], FIELD_BOUNDS.weekday)
  if (!minute || !hour || !day || !month || !weekdayRaw) return null

  // Cron treats 0 and 7 both as Sunday — normalise to 0 so the match below only checks one value.
  const weekday = new Set(Array.from(weekdayRaw, (v) => (v === 7 ? 0 : v)))

  return { minute, hour, day, month, weekday }
}

/** Cheap syntax check ahead of a network round trip — same rules the backend's own `Cronos`
 * parser enforces are NOT reimplemented here (that would be a second, divergent validator); this
 * only catches the obvious "wrong number of fields"/"field out of range" shape so the Save
 * button doesn't light up on something the server would reject outright with an unhelpful blank
 * screen. The server (`JobsValidationService.ValidateCronExpression`) remains the actual
 * authority and free-standing 6-field expressions are waved through here without inspection. */
export function isPlausibleCronExpression(expression: string): boolean {
  const trimmed = expression.trim()
  if (trimmed === '') return true // empty = "reset to default", always legal.
  const fieldCount = trimmed.split(/\s+/).length
  if (fieldCount === 6) return true // seconds format — left to the server, see doc comment above.
  if (fieldCount !== 5) return false
  return parseCron(trimmed) !== null
}

const MINUTE_MS = 60_000
/** Hard cap on how far into the future the brute-force search below will look — about a year of
 * minute-by-minute stepping. Cheap per step (a handful of `Set.has` calls), so this runs in well
 * under a frame even at the cap; a cron that has no occurrence within a year (imaginable only for
 * pathological hand-typed expressions, e.g. Feb 31st) shows no preview rather than hanging. */
const MAX_LOOKAHEAD_MINUTES = 366 * 24 * 60

/**
 * The next `count` UTC occurrences of a 5-field cron expression, strictly after `fromUtc`, minute
 * resolution (seconds are always :00 — matches this catalogue's own presets and is the same
 * granularity the mockup's preview shows). `null` when the expression isn't a 5-field cron this
 * parser understands, or when nothing was found within `MAX_LOOKAHEAD_MINUTES`.
 */
export function nextOccurrencesUtc(expression: string, count: number, fromUtc: Date): Date[] | null {
  const parsed = parseCron(expression)
  if (!parsed) return null

  const results: Date[] = []
  const cursor = new Date(fromUtc)
  cursor.setUTCSeconds(0, 0)
  cursor.setTime(cursor.getTime() + MINUTE_MS) // strictly after `fromUtc`

  for (let step = 0; step < MAX_LOOKAHEAD_MINUTES && results.length < count; step++, cursor.setTime(cursor.getTime() + MINUTE_MS)) {
    if (
      parsed.minute.has(cursor.getUTCMinutes()) &&
      parsed.hour.has(cursor.getUTCHours()) &&
      parsed.day.has(cursor.getUTCDate()) &&
      parsed.month.has(cursor.getUTCMonth() + 1) &&
      parsed.weekday.has(cursor.getUTCDay())
    ) {
      results.push(new Date(cursor))
    }
  }

  return results.length > 0 ? results : null
}

/* ── Draft equality helpers ──────────────────────────────────────────────────────────────────
 * Kept here (not inline in `JobDetailPage`) so the "is this actually different" rule is one
 * function tested once, not re-derived at every call site.
 */

/** A non-negative integer, written exactly the way the server's own validator
 * (`SiteSettingsValidationService.ValidateNumberValue`, `int.TryParse` with `NumberStyles.Integer`
 * in `InvariantCulture`) accepts — no thousands separators, no leading `+`, no decimals. Negative
 * hour/day thresholds have no domain meaning on this screen, so they are rejected client-side too
 * even though the server's own parser would technically accept a leading `-`. */
export function isValidParameterNumber(raw: string): boolean {
  return /^\d+$/.test(raw.trim())
}

/** Cyrillic-safe: plain `toUpperCase`/`toLowerCase` on the first code point works the same for
 * Cyrillic as for Latin, no locale-specific casing table needed here. */
export function capitalizeFirst(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1)
}

/**
 * The short, lowercase phrase this screen shows in three places for the SAME preset: the job
 * list row's `.sub` byline, the summary panel's "Расписание" value, and the schedule card's
 * frequency `Select` (capitalised there via `capitalizeFirst` — one source of copy, two
 * castings). Reads `copy.frequency` rather than owning its own strings, so RU/EN both flow
 * through `jobsCopy.ts` as usual.
 */
export function scheduleFrequencyLabel(preset: CronPreset, copy: JobsCopy): string {
  switch (preset.kind) {
    case 'everyNMinutes':
      return copy.frequency.everyNMinutes(preset.n)
    case 'hourly':
      return copy.frequency.hourly
    case 'everyNHours':
      return copy.frequency.everyNHours(preset.n)
    case 'dailyAt':
      return copy.frequency.dailyAt
    case 'weeklyAt':
      return copy.frequency.weeklyAt
    case 'custom':
      return copy.frequency.custom
  }
}

/* ── «Исключения по продуктам» (tour-date-auto-closure) ─────────────────────────────────────
 * checklist-autoclose-per-tour-2026-08-29.txt, Р2–Р4/F1–F3: одна карточка, живущая ТОЛЬКО на
 * этой задаче — ключ задан здесь один раз, а не разбросан по `JobDetailPage`/loader строковым
 * литералом в каждом месте.
 */
export const AUTO_CLOSURE_JOB_KEY = 'tour-date-auto-closure'

/** Одна строка черновика карточки исключений. `tourName` держится ПРЯМО в строке (а не
 * резолвится заново из списка туров при каждом рендере таблицы): она берётся один раз, в момент
 * выбора тура в пикере (`tourTitleResolver` ниже) или из уже сохранённого `tourName` бэка —
 * так строка остаётся читаемой, даже если тур позже архивировали и он выпал из списка `tours`,
 * который грузит `jobDetailLoader` (`getAllTours` отдаёт только неархивные). */
export interface TourAutoCloseOverrideDraftRow {
  tourId: number
  tourName: string
  leadTimeHours: string
}

/** Положительное целое — строже `isValidParameterNumber` (порог = 0 часов ничего не закрывал бы,
 * что для точечного исключения смысла не несёт, checklist Р2/F... «часы > 0»). */
export function isValidLeadTimeHours(raw: string): boolean {
  return isValidParameterNumber(raw) && Number(raw) > 0
}

/** Черновик «грязный», если набор строк отличается от загруженного по СОДЕРЖИМОМУ — сравнение по
 * `tourId`→`leadTimeHours`, без учёта порядка (порядок в UI — порядок добавления, серверу он не
 * нужен: PUT заменяет набор целиком, не список позиций). */
export function overrideRowsEqual(a: TourAutoCloseOverrideDraftRow[], b: TourAutoCloseOverrideDraftRow[]): boolean {
  if (a.length !== b.length) return false
  const sortById = (rows: TourAutoCloseOverrideDraftRow[]) => [...rows].sort((x, y) => x.tourId - y.tourId)
  const left = sortById(a)
  const right = sortById(b)
  return left.every((row, index) => row.tourId === right[index].tourId && row.leadTimeHours === right[index].leadTimeHours)
}

/** Same shape as `orders/lib/ordersModel.ts`'s `tourTitleResolver` — kept as a small, deliberate
 * duplication rather than a cross-feature import (a feature does not reach into another feature's
 * `lib`), used here to label the «добавить исключение» picker's options with the same
 * interface-language-first/Russian-fallback title a tour shows everywhere else in the admin. */
export function tourTitleResolver(tours: TourInfoModel[], locale: Locale, copy: JobsCopy): (tourId: number) => string {
  const preferred = LANGUAGE_CODE_BY_LOCALE[locale]
  const titles = new Map<number, string>()
  for (const tour of tours) {
    const candidates = tour.translations.filter((t) => t.type === TourTranslationType.Title)
    const title =
      candidates.find((t) => t.languageCode === preferred)?.value?.trim() ||
      candidates.find((t) => t.languageCode === LanguageCode.Russian)?.value?.trim()
    if (title) titles.set(tour.id, title)
  }
  return (tourId: number) => titles.get(tourId) ?? copy.overridesCard.tourFallback(tourId)
}
