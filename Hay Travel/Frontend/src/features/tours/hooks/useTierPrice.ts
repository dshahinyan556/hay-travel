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
  /** Set only when a discount is active — the SAME tier applied to the undiscounted price, so a
   * 5–6 guest booking's strikethrough already carries that tier's surcharge too. `null` when
   * there is no discount (not just when `hidden`). */
  originalTotal: string | null
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
 *
 * `discountPercent` mirrors `OrderCreationService.ApplyDiscount` on the backend: the actual order
 * total the visitor is charged is discount-then-tier too, so what this card shows during booking
 * has to be the same figure, not just the card/detail display price (the "и в бронировании"
 * requirement — a discount that only looked real on the catalog card would be worse than none).
 */
export function useTierPrice(
  basePriceAmd: number,
  guestCount: number,
  discountPercent?: number | null,
): TierPriceView {
  const money = useMoney()
  const hasDiscount = discountPercent != null && discountPercent > 0

  const tiered = applyGroupTier(basePriceAmd, guestCount)
  if (tiered.amountAmd === null) {
    return { tier: tiered.tier, hidden: true, total: null, prepayment: null, originalTotal: null }
  }

  const discountedAmd = hasDiscount ? tiered.amountAmd * (1 - discountPercent! / 100) : tiered.amountAmd

  return {
    tier: tiered.tier,
    hidden: false,
    total: money.format(discountedAmd),
    prepayment: money.format(discountedAmd * PREPAYMENT_SHARE),
    originalTotal: hasDiscount ? money.format(tiered.amountAmd) : null,
  }
}
