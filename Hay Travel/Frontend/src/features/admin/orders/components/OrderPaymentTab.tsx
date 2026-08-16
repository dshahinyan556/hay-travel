import { resolveTier } from '@/shared/currency/pricing'
import type { OrderInfoModel } from '@/shared/types/booking'
import { formatOrderMoney, ordersCopy } from '../lib/ordersCopy'

export interface OrderPaymentTabProps {
  order: OrderInfoModel
}

/**
 * "Оплата" tab of `OrderDetailPage`. Two states:
 *  - `resolveTier(guestCount) === 'hidden'` (7+ guests): the public site never showed this
 *    visitor a price (`BookingCard`'s `largeGroupInvitation`), and `OrderCreationService` mirrors
 *    that by leaving `TotalAmount` at 0 rather than inventing a number — so this tab says "цена по
 *    запросу" instead of "0 AMD", which would read as a bug.
 *  - Otherwise: snapshot/total as plain numbers, prepayment as a filled bar instead of the old
 *    flat "не внесена" text line (B12 redesign, 2026-08-13 — replaces the plain-text prepayment
 *    row after Давид found it unclear).
 */
export function OrderPaymentTab({ order }: OrderPaymentTabProps) {
  const { payment } = order
  const quoteNeeded = resolveTier(order.guestCount) === 'hidden'
  const prepaidRatio = payment.totalAmount > 0 ? payment.prepaidAmount / payment.totalAmount : 0
  const prepaidPercent = Math.max(0, Math.min(100, Math.round(prepaidRatio * 100)))

  const hasDiscount = payment.discountPercent != null && payment.discountPercent > 0

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-neutral-500">{ordersCopy.tourPriceSnapshotLabel}</p>
          {hasDiscount && (
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
              {ordersCopy.discountBadge(payment.discountPercent!)}
            </span>
          )}
        </div>
        <p
          className={`mt-0.5 text-lg font-semibold tabular-nums text-neutral-900 ${hasDiscount ? 'line-through decoration-neutral-400' : ''}`}
        >
          {formatOrderMoney(payment.tourPriceSnapshot, payment.currency)}
        </p>
      </div>

      {quoteNeeded ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">{ordersCopy.quoteNeeded}</p>
          <p className="mt-1 text-amber-700">{ordersCopy.quoteNeededHint}</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm">
            <p className="text-xs text-neutral-500">
              {hasDiscount ? ordersCopy.totalAmountWithDiscountLabel : ordersCopy.totalAmountLabel}
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-900">
              {formatOrderMoney(payment.totalAmount, payment.currency)}
            </p>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs text-neutral-500">{ordersCopy.prepaidAmountLabel}</p>
              <p className="text-xs font-semibold tabular-nums text-neutral-600">{prepaidPercent}%</p>
            </div>
            <div
              role="progressbar"
              aria-valuenow={prepaidPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={ordersCopy.prepaidAmountLabel}
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-100"
            >
              <div
                className={`h-full rounded-full transition-[width] ${
                  payment.prepaidAmount > 0 ? 'bg-brand-600' : 'bg-neutral-200'
                }`}
                style={{ width: `${prepaidPercent}%` }}
              />
            </div>
            <p className="mt-2 font-medium text-neutral-900">
              {payment.prepaidAmount > 0
                ? ordersCopy.prepaidOf(
                    formatOrderMoney(payment.prepaidAmount, payment.currency),
                    formatOrderMoney(payment.totalAmount, payment.currency),
                  )
                : ordersCopy.prepaidNone}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
