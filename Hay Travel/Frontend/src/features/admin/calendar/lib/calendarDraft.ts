/**
 * Черновик страницы «Календарь» — чистые функции над состоянием, без React и без сети.
 *
 * Черновик держит три вида правок, и ничего из них не уходит на сервер до «Сохранить»:
 *  - `toggles` — переключения закрытия дня из панели дня (весь день / тип продукта / продукт);
 *  - `newRules` — правила из панели «Добавить» (массовое закрытие);
 *  - `deleted` — id сохранённых правил, помеченных на удаление.
 *
 * Правило dirty (общее для админки): правка считается только пока она ОТЛИЧАЕТСЯ от сохранённого.
 * Переключение хранится как желаемое состояние (дата × область → закрыто/открыто) и выкидывается из
 * черновика, когда совпало с тем, что сейчас на сервере (`savedClosed`, его знает панель дня, она
 * рисует серверный день) — «закрыл и снова открыл» даёт 0 изменений.
 */

import { ClosureRuleType } from '@/shared/types/booking'
import type {
  CalendarDayModel,
  ClosureRuleCreateModel,
  ClosureRuleInfoModel,
  ClosureRuleScope,
} from '@/shared/types/booking'
import { dayOfWeekCodeOf, isSameScope } from './closureResolver'

/** Желаемое состояние одной области в один день. Существует, только если оно ≠ сохранённому. */
export interface DayToggleDraft {
  dateISO: string
  scope: ClosureRuleScope
  close: boolean
}

/** Одно правило из панели «Добавить». `opId` — одна операция «Добавить в черновик»: она же единица
 * отправки (один `CreateRules`, один `batchId` на сервере). */
export interface NewRuleDraft {
  draftId: number
  opId: number
  model: ClosureRuleCreateModel
}

export interface CalendarDraftState {
  toggles: DayToggleDraft[]
  /** Причина закрытия по датам — одна на день, применяется ко всем переключениям этого дня. Сама по
   * себе правкой не считается. */
  reasons: Record<string, string>
  newRules: NewRuleDraft[]
  deleted: number[]
  /** Счётчик для `draftId`/`opId`. */
  nextId: number
}

export const EMPTY_CALENDAR_DRAFT: CalendarDraftState = {
  toggles: [],
  reasons: {},
  newRules: [],
  deleted: [],
  nextId: 1,
}

const WHOLE_DAY: ClosureRuleScope = { tourId: null, tourType: null }

export function wholeDayScope(): ClosureRuleScope {
  return WHOLE_DAY
}

/** Ключ переключения — по нему же отмечаются успешно сохранённые. */
export function toggleKey(toggle: Pick<DayToggleDraft, 'dateISO' | 'scope'>): string {
  return `${toggle.dateISO}|${toggle.scope.tourId ?? ''}|${toggle.scope.tourType ?? ''}`
}

/**
 * Записать желаемое состояние области.
 * @param savedClosed как область выглядит на сервере СЕЙЧАС — равенство с `close` убирает правку.
 */
export function withToggle(
  state: CalendarDraftState,
  dateISO: string,
  scope: ClosureRuleScope,
  close: boolean,
  savedClosed: boolean,
): CalendarDraftState {
  const others = state.toggles.filter(
    (toggle) => !(toggle.dateISO === dateISO && isSameScope(toggle.scope, scope)),
  )
  // Закрытие дня целиком покрывает всё более узкое закрытие этого дня — оно уже не нужно, иначе на
  // сохранении ушли бы лишние правила рядом с глобальным.
  const kept =
    close && scope.tourId === null && scope.tourType === null
      ? others.filter(
          (toggle) =>
            toggle.dateISO !== dateISO || !toggle.close || (toggle.scope.tourId === null && toggle.scope.tourType === null),
        )
      : others
  return {
    ...state,
    toggles: close === savedClosed ? kept : [...kept, { dateISO, scope, close }],
  }
}

export function withReason(state: CalendarDraftState, dateISO: string, reason: string): CalendarDraftState {
  return { ...state, reasons: { ...state.reasons, [dateISO]: reason } }
}

export function withBulkOperation(
  state: CalendarDraftState,
  models: ClosureRuleCreateModel[],
): CalendarDraftState {
  if (models.length === 0) return state
  const opId = state.nextId
  const added = models.map((model, index) => ({ draftId: opId + index, opId, model }))
  return { ...state, newRules: [...state.newRules, ...added], nextId: opId + models.length }
}

export function withoutNewRules(state: CalendarDraftState, draftIds: number[]): CalendarDraftState {
  if (draftIds.length === 0) return state
  const drop = new Set(draftIds)
  return { ...state, newRules: state.newRules.filter((rule) => !drop.has(rule.draftId)) }
}

export function withDeleted(state: CalendarDraftState, ids: number[], marked: boolean): CalendarDraftState {
  const set = new Set(state.deleted)
  for (const id of ids) {
    if (marked) set.add(id)
    else set.delete(id)
  }
  return { ...state, deleted: [...set] }
}

/** Правило из черновика в форме сохранённого, чтобы таблица и группировка работали с ним как с
 * обычным. Id отрицательный (`-draftId`): так он не пересекается с серверными и сразу отличим. */
export function draftRuleInfo(rule: NewRuleDraft): ClosureRuleInfoModel {
  const { model } = rule
  return {
    id: -rule.draftId,
    tourId: model.tourId,
    tourType: model.tourType ?? null,
    type: model.type,
    action: model.action,
    date: model.date ?? null,
    dayOfWeek: model.dayOfWeek ?? null,
    effectiveFrom: model.effectiveFrom ?? null,
    effectiveTo: model.effectiveTo ?? null,
    reason: model.reason ?? null,
    batchId: `draft-${rule.opId}`,
  }
}

export function isDraftRuleId(id: number): boolean {
  return id < 0
}

/**
 * Сколько изменений в черновике: каждое переключение, каждое новое правило, каждая пометка на
 * удаление. `knownRuleIds` — серверные правила, которые ещё существуют (удалённое кем-то другим
 * пометкой не считается).
 */
export function draftChangeCount(state: CalendarDraftState, knownRuleIds: ReadonlySet<number>): number {
  return (
    state.toggles.length +
    state.newRules.length +
    state.deleted.filter((id) => knownRuleIds.has(id)).length
  )
}

/* ── Отражение черновика на сетке и в панели дня ───────────────────────────────────────────── */

/** Что черновик меняет в одном дне (только переключения панели дня). */
export interface DayDraftMarks {
  global: 'close' | 'open' | null
  closeTypes: number[]
  openTypes: number[]
  closeTours: number[]
  openTours: number[]
}

export function marksOfDate(toggles: readonly DayToggleDraft[], dateISO: string): DayDraftMarks | null {
  const marks: DayDraftMarks = { global: null, closeTypes: [], openTypes: [], closeTours: [], openTours: [] }
  let any = false
  for (const toggle of toggles) {
    if (toggle.dateISO !== dateISO) continue
    any = true
    const { tourId, tourType } = toggle.scope
    if (tourId !== null) (toggle.close ? marks.closeTours : marks.openTours).push(tourId)
    else if (tourType !== null) (toggle.close ? marks.closeTypes : marks.openTypes).push(tourType)
    else marks.global = toggle.close ? 'close' : 'open'
  }
  return any ? marks : null
}

/** Что видно в клетке: переключения дня плюс «этот день задевает блокировка из черновика». */
export interface DayDraftInfo extends DayDraftMarks {
  rulesTouched: boolean
}

/** Серверный день с наложенными переключениями. Для хвостовых дней соседнего месяца (на сервере
 * данных нет) берётся пустой открытый день — как и раньше считала панель. */
export function applyMarksToDay(
  day: CalendarDayModel | null,
  dateISO: string,
  marks: DayDraftMarks | null,
): CalendarDayModel | null {
  if (marks === null) return day
  const base: CalendarDayModel = day ?? {
    date: dateISO,
    isClosedGlobally: false,
    closureReason: null,
    closedTourIds: [],
    closedTourTypes: [],
    totalOrders: 0,
    ordersByTour: [],
  }
  const isClosedGlobally = marks.global === null ? base.isClosedGlobally : marks.global === 'close'
  return {
    ...base,
    isClosedGlobally,
    closureReason: marks.global === null ? base.closureReason : null,
    closedTourIds: [
      ...base.closedTourIds.filter((id) => !marks.openTours.includes(id)),
      ...marks.closeTours.filter((id) => !base.closedTourIds.includes(id)),
    ],
    closedTourTypes: [
      ...(base.closedTourTypes ?? []).filter((type) => !marks.openTypes.includes(type)),
      ...marks.closeTypes.filter((type) => !(base.closedTourTypes ?? []).includes(type)),
    ],
  }
}

/** Покрывает ли правило эту дату (границы недельного правила включительно, `null` — без границы). */
export function ruleCoversDate(
  rule: Pick<ClosureRuleInfoModel, 'type' | 'date' | 'dayOfWeek' | 'effectiveFrom' | 'effectiveTo'>,
  dateISO: string,
): boolean {
  if (rule.type === ClosureRuleType.SpecificDate) return rule.date === dateISO
  if (rule.dayOfWeek !== dayOfWeekCodeOf(dateISO)) return false
  if (rule.effectiveFrom !== null && dateISO < rule.effectiveFrom) return false
  if (rule.effectiveTo !== null && dateISO > rule.effectiveTo) return false
  return true
}

/**
 * Накладывает черновик на клетки сетки: день с переключениями получает «эффективный» день
 * (закрыто/открыто с учётом правок), день, который задевает новое/удаляемое правило, — пометку
 * `rulesTouched`. Исход правила из черновика (закроет или откроет — зависит от приоритетов) здесь
 * НЕ вычисляется: клиентская копия резолвера годится для планирования, но не для картинки
 * (`closureResolver.ts`), поэтому клетка только говорит «задет».
 */
export function applyDraftToGrid<T extends { iso: string; day: CalendarDayModel | null }>(
  days: T[],
  toggles: readonly DayToggleDraft[],
  touchingRules: readonly ClosureRuleInfoModel[],
): (T & { draft: DayDraftInfo | null })[] {
  if (toggles.length === 0 && touchingRules.length === 0) {
    return days.map((day) => ({ ...day, draft: null }))
  }
  return days.map((cell) => {
    const marks = marksOfDate(toggles, cell.iso)
    const rulesTouched = touchingRules.some((rule) => ruleCoversDate(rule, cell.iso))
    if (marks === null && !rulesTouched) return { ...cell, draft: null }
    return {
      ...cell,
      day: applyMarksToDay(cell.day, cell.iso, marks),
      draft: {
        global: null,
        closeTypes: [],
        openTypes: [],
        closeTours: [],
        openTours: [],
        ...marks,
        rulesTouched,
      },
    }
  })
}

/** Правила черновика (новые и помеченные на удаление) в виде одного списка для проверки покрытия. */
export function draftTouchingRules(
  state: CalendarDraftState,
  savedRules: readonly ClosureRuleInfoModel[],
): ClosureRuleInfoModel[] {
  const deleted = new Set(state.deleted)
  return [...state.newRules.map(draftRuleInfo), ...savedRules.filter((rule) => deleted.has(rule.id))]
}
