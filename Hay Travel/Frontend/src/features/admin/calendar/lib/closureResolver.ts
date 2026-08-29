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
  type ClosureRuleScope,
  type DayOfWeekCode,
} from '@/shared/types/booking'

/** `System.DayOfWeek` code of an ISO date (Sunday = 0), which is what native `getDay()` returns. */
export function dayOfWeekCodeOf(dateISO: string): DayOfWeekCode {
  const date = parseISODate(dateISO)
  // A malformed date has no weekday; Sunday is as arbitrary as any answer, and callers only reach
  // this with dates they built themselves from the grid.
  return ((date?.getDay() ?? 0) as DayOfWeekCode)
}

export function isSameScope(a: ClosureRuleScope, b: ClosureRuleScope): boolean {
  return a.tourId === b.tourId && a.tourType === b.tourType
}

/**
 * КОГО спрашиваем — не то же самое, что область правила.
 *
 * В ПРАВИЛЕ `tourId` и `tourType` взаимоисключимы (сервер отбивает оба сразу). В ВОПРОСЕ они
 * сочетаются: спрашивая «закрыт ли продукт X», сервер знает и его id, и его тип и применяет к
 * нему правила обеих областей (`ClosureRuleResolver.IsClosed(rules, date, tourId, tourType)`).
 * Не передать тип здесь значит разойтись с сервером ровно на закрытия по типу.
 */
export type ClosureSubject = ClosureRuleScope

/**
 * Specificity tiers, highest first — six of them since the product-type scope was added
 * (решение 0.27), sitting between "one tour" and "global" exactly as
 * `ClosureRuleResolver.GetSpecificityRank` orders them:
 *
 *   Tour+SpecificDate 6 > Type+SpecificDate 5 > Global+SpecificDate 4
 * > Tour+Weekly 3       > Type+Weekly 2       > Global+Weekly 1
 *
 * `tourId` and `tourType` are mutually exclusive server-side (validation), so this walks from the
 * narrowest scope outwards and never has to consider both being set.
 */
function precedenceOf(rule: ClosureRuleInfoModel): number {
  const isSpecificDate = rule.type === ClosureRuleType.SpecificDate
  if (rule.tourId !== null) return isSpecificDate ? 6 : 3
  if (rule.tourType !== null) return isSpecificDate ? 5 : 2
  return isSpecificDate ? 4 : 1
}

function isApplicable(
  rule: ClosureRuleInfoModel,
  dateISO: string,
  subject: ClosureSubject,
  weekday: DayOfWeekCode,
): boolean {
  // Область: глобальное правило применимо всегда; правило тура — только к этому туру; правило
  // типа продукта — только к продукту этого типа. Запрос без тура и без типа (глобальный срез
  // календаря) видит одни глобальные правила.
  if (rule.tourId !== null && rule.tourId !== subject.tourId) return false
  if (rule.tourType !== null && rule.tourType !== subject.tourType) return false

  if (rule.type === ClosureRuleType.SpecificDate) return rule.date === dateISO

  if (rule.dayOfWeek !== weekday) return false
  // Bounds are inclusive, `null` means unbounded. ISO `YYYY-MM-DD` sorts lexicographically the
  // same way it sorts chronologically, so plain string comparison is correct here.
  if (rule.effectiveFrom !== null && dateISO < rule.effectiveFrom) return false
  if (rule.effectiveTo !== null && dateISO > rule.effectiveTo) return false
  return true
}

/**
 * Is this day closed for `subject` (a product, a whole product type, or the day as a whole)?
 *
 * Among the applicable rules the most specific one wins; ties are broken by the higher `id`, i.e.
 * the most recently created rule. No applicable rule at all → open.
 */
export function resolveClosure(
  rules: readonly ClosureRuleInfoModel[],
  dateISO: string,
  subject: ClosureSubject,
): boolean {
  const weekday = dayOfWeekCodeOf(dateISO)

  let winner: ClosureRuleInfoModel | null = null
  let winnerRank = 0
  for (const rule of rules) {
    if (!isApplicable(rule, dateISO, subject, weekday)) continue
    const rank = precedenceOf(rule)
    if (winner === null || rank > winnerRank || (rank === winnerRank && rule.id > winner.id)) {
      winner = rule
      winnerRank = rank
    }
  }

  return winner !== null && winner.action === ClosureAction.Close
}
