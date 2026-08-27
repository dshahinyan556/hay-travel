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
 * Общий модуль (`shared/booking`, 2026-08): живой счётчик гостей есть теперь и на странице тура, и
 * в каждой строке корзины, а фичи не импортируют друг друга. Само ПРАВИЛО тарифных ступеней
 * по-прежнему живёт в одном месте — `shared/currency/pricing.ts`; этот хук только композирует
 * правило + деньги + условие предоплаты.
 *
 * Guest count only selects the tier (`applyGroupTier`) — it is never multiplied into the price.
 * `tiered.amountAmd` is already the flat total; converting+rounding happens exactly once, inside
 * `money.format`.
 *
 * `discountedBasePriceAmd` mirrors `OrderCreationService`'s order on the backend
 * (`ApplyDiscount` THEN `ResolveTotalAmount`/tier): the tier multiplier applies to the ALREADY
 * discounted price, so what this card shows during booking has to be the same figure, not just
 * the card/detail display price (the "и в бронировании" requirement — a discount that only
 * looked real on the catalog card would be worse than none). It is an absolute price, not a
 * percent — nothing HERE re-derives a rate or checks a date. Which date that price was resolved
 * against is the caller's business: `BookingCard` passes the figure for the picked trip date
 * (`lib/tourDiscount.ts`), matching what the backend will snapshot on the order, and falls back to
 * the server's "today" figure (`Tour.discountedPrice`) while no date is picked.
 */
export function useTierPrice(
  basePriceAmd: number,
  guestCount: number,
  discountedBasePriceAmd?: number | null,
): TierPriceView {
  const money = useMoney()
  const hasDiscount = discountedBasePriceAmd != null && discountedBasePriceAmd < basePriceAmd

  const tiered = applyGroupTier(hasDiscount ? discountedBasePriceAmd : basePriceAmd, guestCount)
  if (tiered.amountAmd === null) {
    return { tier: tiered.tier, hidden: true, total: null, prepayment: null, originalTotal: null }
  }

  const originalTiered = hasDiscount ? applyGroupTier(basePriceAmd, guestCount) : null

  return {
    tier: tiered.tier,
    hidden: false,
    total: money.format(tiered.amountAmd),
    prepayment: money.format(tiered.amountAmd * PREPAYMENT_SHARE),
    originalTotal: originalTiered?.amountAmd != null ? money.format(originalTiered.amountAmd) : null,
  }
}
