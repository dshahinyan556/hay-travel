import { useMoney } from '@/shared/currency'
import { applyFormatPricing, discountedPriceOn, resolveBasePrice, resolveEffectiveFormat } from '@/shared/booking'
import type { CartItem } from '@/shared/cart'
import type { TourDetail } from '@/shared/types/tour'
import type { TransferDetail } from '@/shared/types/transfer'

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
 *
 * ── Формат позиции (батч 2026-08-29) ──────────────────────────────────────────────────────────
 * Каждая строка считается по СВОЕМУ формату: индивидуальная — тир от цены за бронь, групповая —
 * цена за человека × гости. Эффективный формат резолвится от СВЕЖЕГО продукта, а не от того, что
 * лежит в localStorage: если админ перевёл продукт из «обоих» в один формат, выбор посетителя
 * перестаёт что-либо значить — ровно так же поступает `OrderLinePricing.ResolveEffectiveFormat`.
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
  transfers: Record<string, TransferDetail>,
): CartTotalView {
  const money = useMoney()

  let sumAmd = 0
  let originalSumAmd = 0
  let priced = 0
  let discounted = false
  let hasQuoteOnlyLines = false

  for (const item of items) {
    /* Позиция-трансфер (решение 0.10). Цена — это ЦЕНА КЛАССА АВТО, целиком за машину: ни тира
       по гостям, ни умножения на пассажиров, ни скидок (их у трансфера не бывает по домену,
       решение 0.4). Считается по СВЕЖИМ ценам из `GetTransferInfo`, а не по числу из
       localStorage: замороженная цена — худший вид неверных данных. */
    if (item.transfer !== null) {
      const transfer = transfers[String(item.tourId)]
      if (!transfer) continue
      const vehicle = transfer.vehicles.find(
        (option) => option.vehicleClassId === item.transfer?.vehicleClassId,
      )
      if (!vehicle) continue
      const lineTotal = item.transfer.isRoundTrip ? vehicle.roundTripPrice : vehicle.oneWayPrice
      priced += 1
      sumAmd += lineTotal
      originalSumAmd += lineTotal
      continue
    }

    const tour = tours[String(item.tourId)]
    // A position whose tour the backend no longer serves has no price to add. It blocks checkout
    // (§6.3) rather than silently contributing 0.
    if (!tour) continue

    // `null` — продукт продаётся в обоих форматах, а выбор позиции потерялся (правка каталога
    // между добавлением и открытием корзины). Такую строку сервер отобьёт (2046), поэтому в
    // итог она не входит и «цены по запросу» тоже не изображает.
    const format = resolveEffectiveFormat(tour.format, item.format)
    if (format === null) continue

    const base = resolveBasePrice(format, tour.priceFrom, tour.groupPricePerPerson)
    const discountedBase = discountedPriceOn(base, tour.discountWindow, item.tourDate)
    const lineTotal = applyFormatPricing(format, discountedBase ?? base, item.guestCount)

    if (lineTotal.amountAmd === null) {
      // 7+ guests: quoted individually, so it has no number to fold into a total.
      hasQuoteOnlyLines = true
      continue
    }

    priced += 1
    sumAmd += lineTotal.amountAmd
    // The strikethrough carries the SAME tier, so a 5–6 guest line's "old price" includes that
    // tier's surcharge too — otherwise the discount would look bigger than it is.
    const original = applyFormatPricing(format, base, item.guestCount).amountAmd ?? lineTotal.amountAmd
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
