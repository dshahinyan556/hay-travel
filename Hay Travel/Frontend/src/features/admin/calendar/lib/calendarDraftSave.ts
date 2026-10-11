/**
 * Сохранение черновика календаря: превращает его в вызовы API и сообщает, что дошло до сервера.
 *
 * Порядок: сначала удаления помеченных правил, затем переключения дней, затем новые правила из
 * «Добавить». Единица отправки — группа, и неуспешная группа остаётся в черновике, остальные
 * применяются: раньше (`applyDayToggle`/`applyBulk`) каждое действие было отдельным запросом, и
 * одно упавшее не отменяло уже сделанных.
 *
 * Переключения планируются тем же `planDayToggle`, что и раньше, поверх списка правил БЕЗ тех, что
 * уже удалены этим сохранением, — иначе план считал бы базовое состояние по правилам, которых на
 * сервере больше нет.
 */

import {
  createClosureRules,
  deleteClosureRule,
  deleteClosureRules,
} from '@/features/admin/api/adminAvailability'
import type { ClosureRuleCreateModel, ClosureRuleInfoModel } from '@/shared/types/booking'
import type { CalendarDraftState, DayToggleDraft } from './calendarDraft'
import { toggleKey } from './calendarDraft'
import { isEmptyPlan, planDayToggle } from './closureToggle'

export type DraftSaveStage = 'delete' | 'close' | 'open' | 'bulk'

export interface DraftSaveFailure {
  stage: DraftSaveStage
  error: unknown
}

export interface DraftSaveOutcome {
  /** Ключи переключений (`toggleKey`), дошедших до сервера или оказавшихся ненужными. */
  appliedToggleKeys: string[]
  appliedOpIds: number[]
  /** Пометки на удаление отправлены. */
  deletedDone: boolean
  failures: DraftSaveFailure[]
  /** Сколько групп отправлено успешно — отличает «часть сохранилась» от «ничего не ушло». */
  appliedGroups: number
}

export interface DraftSaveInput {
  draft: CalendarDraftState
  /** Все сохранённые правила (из лоадера). */
  rules: readonly ClosureRuleInfoModel[]
  /** `TourType` продукта по id — нужен планировщику (см. `planDayToggle`). */
  tourTypeById: ReadonlyMap<number, number>
}

export async function saveCalendarDraft({ draft, rules, tourTypeById }: DraftSaveInput): Promise<DraftSaveOutcome> {
  const outcome: DraftSaveOutcome = {
    appliedToggleKeys: [],
    appliedOpIds: [],
    deletedDone: false,
    failures: [],
    appliedGroups: 0,
  }

  // 1. Удаление помеченных правил — один запрос (`DeleteRules` не падает на уже удалённых).
  const knownIds = new Set(rules.map((rule) => rule.id))
  const deleteIds = draft.deleted.filter((id) => knownIds.has(id))
  if (deleteIds.length > 0) {
    try {
      await deleteClosureRules(deleteIds)
      outcome.deletedDone = true
      outcome.appliedGroups += 1
    } catch (error) {
      outcome.failures.push({ stage: 'delete', error })
    }
  } else {
    outcome.deletedDone = true
  }
  const planningRules = outcome.deletedDone ? rules.filter((rule) => !deleteIds.includes(rule.id)) : rules

  // 2. Переключения дней. Одна группа = один день и одно направление (то, что раньше делало одно
  //    нажатие в панели): удаления по одному, затем ОДИН create на всю группу.
  const groups = new Map<string, DayToggleDraft[]>()
  for (const toggle of draft.toggles) {
    const key = `${toggle.dateISO}|${toggle.close}`
    groups.set(key, [...(groups.get(key) ?? []), toggle])
  }
  for (const toggles of groups.values()) {
    const { dateISO, close } = toggles[0]
    const reason = draft.reasons[dateISO]?.trim() || null
    const plans = toggles.map((toggle) =>
      planDayToggle(
        planningRules,
        dateISO,
        toggle.scope,
        close,
        reason,
        toggle.scope.tourId === null ? null : (tourTypeById.get(toggle.scope.tourId) ?? null),
      ),
    )
    const plan = {
      deleteIds: [...new Set(plans.flatMap((p) => p.deleteIds))],
      create: plans.flatMap((p) => p.create),
    }
    try {
      if (!isEmptyPlan(plan)) {
        for (const id of plan.deleteIds) await deleteClosureRule(id)
        if (plan.create.length > 0) await createClosureRules(plan.create)
        outcome.appliedGroups += 1
      }
      outcome.appliedToggleKeys.push(...toggles.map(toggleKey))
    } catch (error) {
      outcome.failures.push({ stage: close ? 'close' : 'open', error })
    }
  }

  // 3. Новые правила — по операции «Добавить в черновик».
  const operations = new Map<number, ClosureRuleCreateModel[]>()
  for (const rule of draft.newRules) {
    operations.set(rule.opId, [...(operations.get(rule.opId) ?? []), rule.model])
  }
  for (const [opId, models] of operations) {
    try {
      await createClosureRules(models)
      outcome.appliedOpIds.push(opId)
      outcome.appliedGroups += 1
    } catch (error) {
      outcome.failures.push({ stage: 'bulk', error })
    }
  }

  return outcome
}

/** Что осталось в черновике после сохранения: всё, что не дошло до сервера. */
export function remainingDraft(draft: CalendarDraftState, outcome: DraftSaveOutcome): CalendarDraftState {
  const applied = new Set(outcome.appliedToggleKeys)
  const toggles = draft.toggles.filter((toggle) => !applied.has(toggleKey(toggle)))
  const opIds = new Set(outcome.appliedOpIds)
  const reasons: Record<string, string> = {}
  for (const toggle of toggles) {
    if (draft.reasons[toggle.dateISO] !== undefined) reasons[toggle.dateISO] = draft.reasons[toggle.dateISO]
  }
  return {
    ...draft,
    toggles,
    reasons,
    newRules: draft.newRules.filter((rule) => !opIds.has(rule.opId)),
    deleted: outcome.deletedDone ? [] : draft.deleted,
  }
}
