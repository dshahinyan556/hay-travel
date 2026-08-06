import { applyGroupTier, useMoney, type PriceTier } from '@/shared/currency'

/**
 * Share of the total taken as a deposit. Booking policy, so it lives with the booking hook rather
 * than in `shared/currency` (which owns money math, not commercial terms).
 */
export const PREPAYMENT_SHARE = 0.2

export interface TierPriceView {
  tier: PriceTier
  /** Convenience for the render branch — `tier === 'hidden'`. */
  hidden: boolean
  /** All three are `null` — and only null — when `hidden`. Already formatted for display. */
  perPerson: string | null
  total: string | null
  prepayment: string | null
}

/**
 * The live figures for `BookingCard`: base AMD price + guest count → formatted strings in the
 * visitor's currency.
 *
 * Feature-local, not shared: the group tier only applies where a live guest counter exists, which
 * is that one component. The RULE itself still lives in `shared/currency/pricing.ts` — this hook
 * composes rule + money + booking policy and never re-expresses any of them.
 *
 * Order of operations matters and is the one from `pricing.ts`: everything is computed in AMD
 * (tier → × guests → deposit share) and converted+rounded exactly once, inside `money.format`.
 * `prepayAmd` is deliberately NOT pre-rounded in AMD — rounding is the last step, not the middle
 * one.
 */
export function useTierPrice(basePerPersonAmd: number, guestCount: number): TierPriceView {
  const money = useMoney()

  const tiered = applyGroupTier(basePerPersonAmd, guestCount)
  if (tiered.amountAmd === null) {
    return { tier: tiered.tier, hidden: true, perPerson: null, total: null, prepayment: null }
  }

  const totalAmd = tiered.amountAmd * guestCount

  return {
    tier: tiered.tier,
    hidden: false,
    perPerson: money.format(tiered.amountAmd),
    total: money.format(totalAmd),
    prepayment: money.format(totalAmd * PREPAYMENT_SHARE),
  }
}
