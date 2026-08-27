import { applyGroupTier, useMoney } from '@/shared/currency'
import { discountedPriceOn } from '@/shared/booking'
import type { CartItem } from '@/shared/cart'
import type { TourDetail } from '@/shared/types/tour'

/**
 * The cart's grand total (spec 008 §8.2).
 *
 * ROUNDING RULE, non-negotiable (ADR 008/009): sum in AMD, convert and format exactly ONCE at the
 * end. Adding up already-converted (or, worse, already-formatted) per-line figures would drift by
 * the rounding step on every line and produce a total that does not match the visible sum of its
 * own rows.
 *
 * The figure stays ADVISORY. The server computes its own total and knows nothing about the 5–6
 * guest tier in `shared/currency/pricing.ts` — that is already documented on the booking form, and
 * the cart does not change it.
 */

export interface CartTotalView {
  /** Отформатированная сумма в валюте посетителя; null — все позиции «по запросу». */
  total: string | null
  /** Отформатированная сумма БЕЗ скидок; null — скидок нет ни на одной позиции. */
  originalTotal: string | null
  /** true — часть позиций не имеет отображаемой цены (7+ гостей). */
  hasQuoteOnlyLines: boolean
}

export function useCartTotal(
  items: readonly CartItem[],
  tours: Record<string, TourDetail>,
): CartTotalView {
  const money = useMoney()

  let sumAmd = 0
  let originalSumAmd = 0
  let priced = 0
  let discounted = false
  let hasQuoteOnlyLines = false

  for (const item of items) {
    const tour = tours[String(item.tourId)]
    // A position whose tour the backend no longer serves has no price to add. It blocks checkout
    // (§6.3) rather than silently contributing 0.
    if (!tour) continue

    const discountedBase = discountedPriceOn(tour.priceFrom, tour.discountWindow, item.tourDate)
    const base = discountedBase ?? tour.priceFrom
    const tiered = applyGroupTier(base, item.guestCount)

    if (tiered.amountAmd === null) {
      // 7+ guests: quoted individually, so it has no number to fold into a total.
      hasQuoteOnlyLines = true
      continue
    }

    priced += 1
    sumAmd += tiered.amountAmd
    // The strikethrough carries the SAME tier, so a 5–6 guest line's "old price" includes that
    // tier's surcharge too — otherwise the discount would look bigger than it is.
    const original = applyGroupTier(tour.priceFrom, item.guestCount).amountAmd ?? tiered.amountAmd
    originalSumAmd += original
    if (discountedBase !== null) discounted = true
  }

  if (priced === 0) return { total: null, originalTotal: null, hasQuoteOnlyLines }

  return {
    total: money.format(sumAmd),
    originalTotal: discounted && originalSumAmd > sumAmd ? money.format(originalSumAmd) : null,
    hasQuoteOnlyLines,
  }
}
