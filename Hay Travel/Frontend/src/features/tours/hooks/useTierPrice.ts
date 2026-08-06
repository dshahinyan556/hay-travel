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
  /** Both are `null` — and only null — when `hidden`. Already formatted for display. */
  total: string | null
  prepayment: string | null
}

/**
 * The live figures for `BookingCard`: base AMD price (flat, for up to 4 guests — NOT per person) +
 * guest count → formatted strings in the visitor's currency.
 *
 * Feature-local, not shared: the group tier only applies where a live guest counter exists, which
 * is that one component. The RULE itself still lives in `shared/currency/pricing.ts` — this hook
 * composes rule + money + booking policy and never re-expresses any of them.
 *
 * Guest count only selects the tier (`applyGroupTier`) — it is never multiplied into the price.
 * `tiered.amountAmd` is already the flat total; converting+rounding happens exactly once, inside
 * `money.format`.
 */
export function useTierPrice(basePriceAmd: number, guestCount: number): TierPriceView {
  const money = useMoney()

  const tiered = applyGroupTier(basePriceAmd, guestCount)
  if (tiered.amountAmd === null) {
    return { tier: tiered.tier, hidden: true, total: null, prepayment: null }
  }

  return {
    tier: tiered.tier,
    hidden: false,
    total: money.format(tiered.amountAmd),
    prepayment: money.format(tiered.amountAmd * PREPAYMENT_SHARE),
  }
}
