/**
 * Admin Availability API — `api/Availability`, `[Authorize(Roles = "Admin")]` on the whole
 * controller except `GetClosedDates` (public, and therefore living in `shared/api/booking.ts`
 * instead). Every call here 403s for a TourManager; mirrored client-side by `canManageCalendar`.
 *
 * Closure state is stored as RULES, not as materialized dates (ADR 012): `GetCalendar` returns the
 * server's resolved answer per day, and there is no "update rule" endpoint by design — a rule is
 * created or deleted, never edited (spec 001 §8).
 */

import { authFetch } from '@/shared/auth'
import type { CalendarMonthModel, ClosureRuleCreateModel, ClosureRuleInfoModel } from '@/shared/types/booking'

/**
 * GET one month of the availability grid: per day, the order counts by tour plus the resolved
 * closure state. `month` is 1..12 (NOT `Date`'s 0-based month).
 *
 * @param signal optional `AbortSignal` — `useCalendarMonth` cancels in-flight months when the
 *        admin pages past them faster than the network answers.
 */
export function getCalendarMonth(
  year: number,
  month: number,
  signal?: AbortSignal,
): Promise<CalendarMonthModel> {
  return authFetch<CalendarMonthModel>(`api/Availability/GetCalendar?year=${year}&month=${month}`, {
    signal,
  })
}

/** GET closure rules. Without `tourId` — every rule (global + all tour-scoped); with it — that
 * tour's rules plus the global ones that also apply to it. */
export function getClosureRules(tourId?: number): Promise<ClosureRuleInfoModel[]> {
  return authFetch<ClosureRuleInfoModel[]>(
    `api/Availability/GetRules${tourId != null ? `?tourId=${tourId}` : ''}`,
  )
}

/** POST a batch of rules — ONE request for a whole bulk operation, because the endpoint takes a
 * list (spec 001 §5.2). Returns the created rules as stored. */
export function createClosureRules(
  models: ClosureRuleCreateModel[],
): Promise<ClosureRuleInfoModel[]> {
  return authFetch<ClosureRuleInfoModel[]>('api/Availability/CreateRules', {
    method: 'POST',
    body: JSON.stringify(models),
  })
}

/** DELETE one rule. Answers `RelationalEntityNotFound` when it is already gone (someone else
 * deleted it) — the caller turns that into "обновите страницу", not a crash. */
export function deleteClosureRule(id: number): Promise<void> {
  return authFetch<void>(`api/Availability/DeleteRule?id=${id}`, { method: 'DELETE' })
}
