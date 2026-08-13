/**
 * Client-side copy of the server's `ClosureRuleResolver.IsClosed` (ADR 012 / ADR 015).
 *
 * CHANGE ONLY TOGETHER WITH `Backend/.../Services/Availability/ClosureRuleResolver.cs`.
 *
 * Used EXCLUSIVELY to plan mutations (`closureToggle.ts`) and to preview a bulk operation. It must
 * never drive what the screen DISPLAYS: closed badges in the grid and greyed-out days in the
 * booking card come from the server's own answer (`CalendarMonthModel`, `GetClosedDates`). That
 * boundary is what keeps a divergence between the two implementations from ever producing a wrong
 * picture — at worst it produces one redundant rule, which the next reload makes visible.
 *
 * Why a copy exists at all: the backend has no "set this day open/closed" endpoint (spec 001 §8),
 * only bulk-create and delete. To answer "what do I have to send so this day becomes open?" the
 * client has to know what the remaining rules would say — which is precedence logic.
 */

import { parseISODate } from '@/shared/lib/date'
import {
  ClosureAction,
  ClosureRuleType,
  type ClosureRuleInfoModel,
  type DayOfWeekCode,
} from '@/shared/types/booking'

/** `System.DayOfWeek` code of an ISO date (Sunday = 0), which is what native `getDay()` returns. */
export function dayOfWeekCodeOf(dateISO: string): DayOfWeekCode {
  const date = parseISODate(dateISO)
  // A malformed date has no weekday; Sunday is as arbitrary as any answer, and callers only reach
  // this with dates they built themselves from the grid.
  return ((date?.getDay() ?? 0) as DayOfWeekCode)
}

/** Specificity tiers, highest first: `Tour+SpecificDate` > `Global+SpecificDate` > `Tour+Weekly`
 * > `Global+Weekly` (ADR 012). */
function precedenceOf(rule: ClosureRuleInfoModel): number {
  const scoped = rule.tourId !== null
  if (rule.type === ClosureRuleType.SpecificDate) return scoped ? 4 : 3
  return scoped ? 2 : 1
}

function isApplicable(
  rule: ClosureRuleInfoModel,
  dateISO: string,
  tourId: number | null,
  weekday: DayOfWeekCode,
): boolean {
  // Scope: a global rule applies to everything; a tour rule only to its own tour.
  if (rule.tourId !== null && rule.tourId !== tourId) return false

  if (rule.type === ClosureRuleType.SpecificDate) return rule.date === dateISO

  if (rule.dayOfWeek !== weekday) return false
  // Bounds are inclusive, `null` means unbounded. ISO `YYYY-MM-DD` sorts lexicographically the
  // same way it sorts chronologically, so plain string comparison is correct here.
  if (rule.effectiveFrom !== null && dateISO < rule.effectiveFrom) return false
  if (rule.effectiveTo !== null && dateISO > rule.effectiveTo) return false
  return true
}

/**
 * Is this day closed for `tourId` (or globally, when `tourId` is `null`)?
 *
 * Among the applicable rules the most specific one wins; ties are broken by the higher `id`, i.e.
 * the most recently created rule. No applicable rule at all → open.
 */
export function resolveClosure(
  rules: readonly ClosureRuleInfoModel[],
  dateISO: string,
  tourId: number | null,
): boolean {
  const weekday = dayOfWeekCodeOf(dateISO)

  let winner: ClosureRuleInfoModel | null = null
  let winnerRank = 0
  for (const rule of rules) {
    if (!isApplicable(rule, dateISO, tourId, weekday)) continue
    const rank = precedenceOf(rule)
    if (winner === null || rank > winnerRank || (rank === winnerRank && rule.id > winner.id)) {
      winner = rule
      winnerRank = rank
    }
  }

  return winner !== null && winner.action === ClosureAction.Close
}
