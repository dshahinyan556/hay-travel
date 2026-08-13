/**
 * Turns "make this day closed / open" into the minimal set of API calls that achieves it.
 *
 * Needed because the backend stores rules, not days (ADR 012), and offers no "set day state"
 * endpoint (ADR 015): closing a day that a weekly rule already closes must create nothing, while
 * opening it must create an `Open` exception rather than delete anything.
 */

import { ClosureAction, ClosureRuleType } from '@/shared/types/booking'
import type { ClosureRuleCreateModel, ClosureRuleInfoModel } from '@/shared/types/booking'
import { resolveClosure } from './closureResolver'

/** What to delete and what to create so the day reaches the requested state. */
export interface ClosurePlan {
  deleteIds: number[]
  create: ClosureRuleCreateModel[]
}

/**
 * @param rules   ALL known rules (from the loader), not just this day's.
 * @param dateISO the day being toggled.
 * @param tourId  `null` = the whole day, globally; otherwise one tour.
 * @param close   `true` → the day must end up closed, `false` → open.
 * @param reason  Optional note, same field the bulk panel writes (B12, 2026-08-13) — a
 *                single-day close previously had nowhere to put one.
 */
export function planDayToggle(
  rules: readonly ClosureRuleInfoModel[],
  dateISO: string,
  tourId: number | null,
  close: boolean,
  reason: string | null = null,
): ClosurePlan {
  // Same SCOPE only: toggling one tour must not delete a global rule — that would silently change
  // every other tour's day too.
  const isSameScopeSpecific = (rule: ClosureRuleInfoModel): boolean =>
    rule.type === ClosureRuleType.SpecificDate && rule.date === dateISO && rule.tourId === tourId

  const deleteIds = rules.filter(isSameScopeSpecific).map((rule) => rule.id)

  // What the day would say once those are gone — i.e. what weekly rules (and, for a tour toggle,
  // global rules) dictate on their own.
  const baseline = resolveClosure(
    rules.filter((rule) => !isSameScopeSpecific(rule)),
    dateISO,
    tourId,
  )

  const create: ClosureRuleCreateModel[] =
    baseline === close
      ? [] // Removing the overrides is already enough.
      : [
          {
            tourId,
            type: ClosureRuleType.SpecificDate,
            action: close ? ClosureAction.Close : ClosureAction.Open,
            date: dateISO,
            reason,
          },
        ]

  return { deleteIds, create }
}

/** Nothing to send — the day is already in the requested state and no stale override exists. */
export function isEmptyPlan(plan: ClosurePlan): boolean {
  return plan.deleteIds.length === 0 && plan.create.length === 0
}
