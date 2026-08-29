/**
 * State of the bulk-closure form and its compilation into `ClosureRuleCreateModel[]`.
 *
 * Pure: no network, no React state, no copy of its own — the messages come in as a `CalendarCopy`
 * parameter (spec 009 §3: a pure module never resolves the locale itself), so the panel can render
 * a live "N rules will be created" preview by calling this on every change and the same function is
 * what the submit path sends.
 */

import { eachDayInRange, formatISODate, parseISODate, stripTime } from '@/shared/lib/date'
import type { TourType } from '@/features/admin/lib/enums'
import {
  ClosureAction,
  ClosureRuleType,
  type ClosureRuleCreateModel,
  type ClosureRuleScope,
  type DayOfWeekCode,
} from '@/shared/types/booking'
import type { CalendarCopy } from './calendarCopy'

export type BulkMode = 'range' | 'weekly'

/**
 * Область действия массовой операции — ровно те три варианта, которые понимает бэк
 * (`ClosureRuleScope`, решение 0.27):
 *  - `global` — все продукты, одно правило на дату;
 *  - `types` — все продукты выбранных ТИПОВ, включая заведённые позже: одно правило на
 *    (тип × дата);
 *  - `products` — перечисленные продукты, одно правило на (продукт × дата).
 *
 * До 2026-08-29 второго варианта не существовало, и «Туры»/«Экскурсии» были пресетами, которые
 * просто набивали список id из текущего каталога — продукт, созданный завтра, под такое правило
 * уже не попадал. Пресеты убраны вместе с появлением настоящей области; фильтр по региону
 * остался (области «регион» на бэке нет, и это по-прежнему просто помощник выбора).
 */
export type BulkScope = 'global' | 'types' | 'products'

export interface BulkClosureForm {
  action: ClosureAction
  mode: BulkMode
  scope: BulkScope
  /** `YYYY-MM-DD`. Range bounds in `range` mode; the optional validity period in `weekly` mode. */
  fromISO: string
  toISO: string
  /** `weekly` mode only; at least one. */
  weekdays: DayOfWeekCode[]
  /** `scope === 'types'` only; at least one. */
  tourTypes: TourType[]
  /** `scope === 'products'` only; at least one. Пустой список больше НЕ означает «все продукты»:
   * глобальная область выражается значением `scope`, а не отсутствием выбора. */
  tourIds: number[]
  reason: string
}

/** The panel resets to this on close, so a half-filled operation never leaks into the next one. */
export const emptyBulkForm: BulkClosureForm = {
  action: ClosureAction.Close,
  mode: 'range',
  scope: 'global',
  fromISO: '',
  toISO: '',
  weekdays: [],
  tourTypes: [],
  tourIds: [],
  reason: '',
}

/** Область формы → список целей. Одна цель = одно правило на каждую дату / день недели. */
function resolveScopes(form: BulkClosureForm): ClosureRuleScope[] {
  if (form.scope === 'types') {
    return form.tourTypes.map((tourType) => ({ tourId: null, tourType }))
  }
  if (form.scope === 'products') {
    return form.tourIds.map((tourId) => ({ tourId, tourType: null }))
  }
  return [{ tourId: null, tourType: null }]
}

/**
 * Cap on one bulk operation. A range × tours product explodes fast (92 days × 10 tours = 920
 * rules), and somebody has to read that list on the «Правила» tab afterwards. Past this we ask for
 * a narrower range or a weekly rule instead.
 */
export const MAX_BULK_RULES = 300

/** Column limit on `ClosureRule.Reason`. */
export const MAX_REASON_LENGTH = 500

export type BulkValidation =
  | { ok: true; models: ClosureRuleCreateModel[] }
  | { ok: false; message: string }

export function compileBulkForm(form: BulkClosureForm, copy: CalendarCopy): BulkValidation {
  const reason = form.reason.trim()
  if (reason.length > MAX_REASON_LENGTH) {
    return { ok: false, message: copy.bulkErrorReasonTooLong }
  }
  const reasonValue = reason === '' ? null : reason

  const scopes = resolveScopes(form)
  if (scopes.length === 0) {
    return {
      ok: false,
      message: form.scope === 'types' ? copy.bulkErrorTypesRequired : copy.bulkErrorProductsRequired,
    }
  }

  const models: ClosureRuleCreateModel[] = []

  const todayStart = stripTime(new Date())

  if (form.mode === 'range') {
    const from = parseISODate(form.fromISO)
    const to = parseISODate(form.toISO)
    if (from === null || to === null) {
      return { ok: false, message: copy.bulkErrorRangeRequired }
    }
    if (from.getTime() > to.getTime()) {
      return { ok: false, message: copy.bulkErrorRangeOrder }
    }
    // Бэкдейтинг запрещён везде (B12, 2026-08-13) — раньше это было намеренно разрешено
    // ("хозяйственный смысл"), решение Давида отменило исключение без остатка.
    if (from.getTime() < todayStart.getTime()) {
      return { ok: false, message: copy.bulkErrorPastDate }
    }
    const days = eachDayInRange(from, to)
    // Counted BEFORE materializing: this runs on every keystroke for the live preview, and a
    // five-year range × twenty tours would otherwise build ~36k objects just to be rejected.
    const total = days.length * scopes.length
    if (total > MAX_BULK_RULES) {
      return { ok: false, message: copy.bulkErrorTooMany(total, MAX_BULK_RULES) }
    }
    for (const day of days) {
      const date = formatISODate(day)
      for (const scope of scopes) {
        models.push({
          tourId: scope.tourId,
          tourType: scope.tourType,
          type: ClosureRuleType.SpecificDate,
          action: form.action,
          date,
          reason: reasonValue,
        })
      }
    }
  } else {
    if (form.weekdays.length === 0) {
      return { ok: false, message: copy.bulkErrorWeekdaysRequired }
    }
    // Both bounds are optional here; if both are given they still have to be ordered.
    const from = form.fromISO === '' ? null : parseISODate(form.fromISO)
    const to = form.toISO === '' ? null : parseISODate(form.toISO)
    if (from !== null && to !== null && from.getTime() > to.getTime()) {
      return { ok: false, message: copy.bulkErrorRangeOrder }
    }
    if (from !== null && from.getTime() < todayStart.getTime()) {
      return { ok: false, message: copy.bulkErrorPastDate }
    }
    for (const dayOfWeek of form.weekdays) {
      for (const scope of scopes) {
        models.push({
          tourId: scope.tourId,
          tourType: scope.tourType,
          type: ClosureRuleType.Weekly,
          action: form.action,
          dayOfWeek,
          effectiveFrom: from === null ? null : formatISODate(from),
          effectiveTo: to === null ? null : formatISODate(to),
          reason: reasonValue,
        })
      }
    }
  }

  if (models.length > MAX_BULK_RULES) {
    return {
      ok: false,
      message: copy.bulkErrorTooMany(models.length, MAX_BULK_RULES),
    }
  }

  return { ok: true, models }
}
