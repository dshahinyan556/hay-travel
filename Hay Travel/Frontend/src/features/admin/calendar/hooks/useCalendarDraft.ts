import { useMemo, useState } from 'react'
import type {
  CalendarDayModel,
  ClosureRuleCreateModel,
  ClosureRuleInfoModel,
  ClosureRuleScope,
} from '@/shared/types/booking'
import {
  applyMarksToDay,
  draftChangeCount,
  draftRuleInfo,
  draftTouchingRules,
  EMPTY_CALENDAR_DRAFT,
  marksOfDate,
  withBulkOperation,
  withDeleted,
  withoutNewRules,
  withReason,
  withToggle,
  type CalendarDraftState,
  type DayDraftMarks,
  type DayToggleDraft,
} from '../lib/calendarDraft'

export interface CalendarDraft {
  state: CalendarDraftState
  toggles: readonly DayToggleDraft[]
  /** Сохранённые правила, помеченные на удаление (только существующие). */
  deletedIds: ReadonlySet<number>
  /** Новые правила в форме сохранённых (id < 0) — для таблицы. */
  draftRules: ClosureRuleInfoModel[]
  /** Новые + помеченные на удаление — чем «задет» день, когда исход зависит от приоритетов. */
  touchingRules: ClosureRuleInfoModel[]
  changeCount: number
  /** `changeCount > 0`. Правки, совпавшие с сохранённым, в черновике не живут. */
  isDirty: boolean
  /** Есть правки переключений дней / правил — для точек на вкладках. */
  hasToggles: boolean
  hasRuleChanges: boolean
  marksOf: (dateISO: string) => DayDraftMarks | null
  /** Серверный день с наложенным черновиком. */
  effectiveDay: (day: CalendarDayModel | null, dateISO: string) => CalendarDayModel | null
  reasonOf: (dateISO: string) => string
  setToggle: (dateISO: string, scope: ClosureRuleScope, close: boolean, savedClosed: boolean) => void
  setReason: (dateISO: string, reason: string) => void
  addBulk: (models: ClosureRuleCreateModel[]) => void
  /** `draftId`-ы (положительные), не id из таблицы. */
  discardNewRules: (draftIds: number[]) => void
  markDeleted: (ids: number[], marked: boolean) => void
  replace: (next: CalendarDraftState) => void
  reset: () => void
}

/**
 * Состояние черновика календаря. Все правила игры — в `lib/calendarDraft.ts`; хук только держит
 * состояние и отдаёт производные значения. `savedRules` — список из лоадера: по нему отсеиваются
 * пометки на удаление правил, которых уже нет (удалены другим админом/в другой вкладке).
 */
export function useCalendarDraft(savedRules: readonly ClosureRuleInfoModel[]): CalendarDraft {
  const [state, setState] = useState<CalendarDraftState>(EMPTY_CALENDAR_DRAFT)

  const knownIds = useMemo(() => new Set(savedRules.map((rule) => rule.id)), [savedRules])
  const deletedIds = useMemo(
    () => new Set(state.deleted.filter((id) => knownIds.has(id))),
    [state.deleted, knownIds],
  )
  const draftRules = useMemo(() => state.newRules.map(draftRuleInfo), [state.newRules])
  const touchingRules = useMemo(() => draftTouchingRules(state, savedRules), [state, savedRules])
  const changeCount = draftChangeCount(state, knownIds)

  return {
    state,
    toggles: state.toggles,
    deletedIds,
    draftRules,
    touchingRules,
    changeCount,
    isDirty: changeCount > 0,
    hasToggles: state.toggles.length > 0,
    hasRuleChanges: state.newRules.length > 0 || deletedIds.size > 0,
    marksOf: (dateISO) => marksOfDate(state.toggles, dateISO),
    effectiveDay: (day, dateISO) => applyMarksToDay(day, dateISO, marksOfDate(state.toggles, dateISO)),
    reasonOf: (dateISO) => state.reasons[dateISO] ?? '',
    setToggle: (dateISO, scope, close, savedClosed) =>
      setState((prev) => withToggle(prev, dateISO, scope, close, savedClosed)),
    setReason: (dateISO, reason) => setState((prev) => withReason(prev, dateISO, reason)),
    addBulk: (models) => setState((prev) => withBulkOperation(prev, models)),
    discardNewRules: (draftIds) => setState((prev) => withoutNewRules(prev, draftIds)),
    markDeleted: (ids, marked) => setState((prev) => withDeleted(prev, ids, marked)),
    replace: setState,
    reset: () => setState(EMPTY_CALENDAR_DRAFT),
  }
}
