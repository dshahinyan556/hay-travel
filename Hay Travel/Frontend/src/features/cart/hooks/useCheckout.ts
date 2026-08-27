import { useCallback, useRef, useState } from 'react'
import { createOrder } from '@/shared/api/booking'
import { getAuthState } from '@/shared/auth'
import { ApiError } from '@/shared/lib/http'
import { clearCart, type CartItem } from '@/shared/cart'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import {
  ORDER_HAS_INVALID_LINES,
  checkoutFormMessage,
  errorCodeOf,
  isSessionFailure,
  lineFailureReason,
  orderLineErrorsOf,
  type CheckoutLineFailureReason,
} from '../lib/checkoutErrors'

/**
 * The cart's ONE network call (ADR 025 / spec 008 §7).
 *
 * `submit` sends the whole cart as a single `createOrder({ lines })` and gets back either one
 * order number or one rejection. There is deliberately NO loop over positions, no per-item request
 * queue, no "send the rest" retry and no partial-success outcome — all of that was the first
 * revision of this design and was reversed: a cart is one order.
 *
 * Duplicate protection is exactly two things: the `running` flag (a second submit cannot start
 * while the first is in flight) and an empty cart after success (there is nothing left to send).
 * Nothing is removed from the cart before the server confirms, and nothing is removed on failure —
 * because nothing was created.
 */

export interface CheckoutResult {
  /** Номер СОЗДАННОГО заказа — ровно один на всю корзину. */
  orderNumber: string
  /** Сколько позиций вошло в созданный заказ — корзина к моменту показа результата уже пуста. */
  lineCount: number
}

/** A date the SERVER rejected for a tour in this session — fed back into that tour's calendar so
 * the same day cannot be picked twice. Keyed by `String(tourId)`, because closed days belong to
 * the tour, not to one cart row: two rows of the same tour must see the same set. */
export type ServerClosedDates = Readonly<Record<string, readonly string[]>>

export interface UseCheckout {
  running: boolean
  /** Ошибки по `CartItem.id`. Непусто только после неуспешной попытки; чистится по мере правок. */
  lineErrors: ReadonlyMap<string, CheckoutLineFailureReason>
  /** Ошибка, не привязанная к строке: сеть, 5xx, 2028/2032, нераспознанное тело. Готовая копия. */
  formError: string | null
  result: CheckoutResult | null
  /** Анонимный посетитель нажал «Отправить» — показать блок входа. */
  authNotice: boolean
  /** Даты, отклонённые сервером в этой сессии, по `String(tourId)`. */
  serverClosed: ServerClosedDates
  submit: (items: readonly CartItem[]) => Promise<void>
  /** Снять ошибку конкретной строки (вызывается из onChangeDate/onChangeGuests). */
  clearLineError: (itemId: string) => void
}

const NO_LINE_ERRORS: ReadonlyMap<string, CheckoutLineFailureReason> = new Map()

export function useCheckout(): UseCheckout {
  const { t } = useLocale()

  const [running, setRunning] = useState(false)
  const [lineErrors, setLineErrors] = useState(NO_LINE_ERRORS)
  const [formError, setFormError] = useState<string | null>(null)
  const [result, setResult] = useState<CheckoutResult | null>(null)
  const [authNotice, setAuthNotice] = useState(false)
  const [serverClosed, setServerClosed] = useState<ServerClosedDates>({})

  /* Guards the double-submit window that `running` alone cannot cover: two clicks inside the same
     React batch would both read `running === false`. */
  const inFlight = useRef(false)

  const clearLineError = useCallback((itemId: string) => {
    setLineErrors((prev) => {
      if (!prev.has(itemId)) return prev
      const next = new Map(prev)
      next.delete(itemId)
      return next
    })
  }, [])

  const submit = useCallback(
    async (items: readonly CartItem[]) => {
      if (inFlight.current) return
      if (items.length === 0) return

      const { status } = getAuthState()
      // `'idle' | 'loading'` means the session is still resolving — that is "unknown", not
      // "anonymous", and must not produce a sign-in prompt.
      if (status !== 'authenticated' && status !== 'anonymous') return
      if (status === 'anonymous') {
        // The network is not touched at all: no request is made, so nothing is left half-done
        // while the visitor goes to sign in.
        setAuthNotice(true)
        return
      }

      /* Frozen order of the request. `index` in the answer points into THIS array, not into the
         store — between sending and answering another tab may have changed the cart. */
      const submitted = [...items]

      inFlight.current = true
      setRunning(true)
      setFormError(null)
      setAuthNotice(false)
      setLineErrors(NO_LINE_ERRORS)

      try {
        const order = await createOrder({
          lines: submitted.map((item) => ({
            tourId: item.tourId,
            tourDate: item.tourDate,
            guestCount: item.guestCount,
          })),
        })
        // The order exists in full — the cart has nothing left to hold.
        clearCart()
        setResult({ orderNumber: order.number, lineCount: submitted.length })
      } catch (err) {
        if (isSessionFailure(err)) {
          // The cart is intact and we do NOT redirect on our own: the visitor presses the link in
          // the sign-in block, comes back, and the cart is still here.
          setAuthNotice(true)
          setFormError(checkoutFormMessage(err, t))
          return
        }

        const perLine =
          err instanceof ApiError && errorCodeOf(err.body) === ORDER_HAS_INVALID_LINES
            ? orderLineErrorsOf(err.body)
            : []

        if (perLine.length === 0) {
          setFormError(checkoutFormMessage(err, t))
          return
        }

        const nextErrors = new Map<string, CheckoutLineFailureReason>()
        const nextClosed: Record<string, string[]> = {}
        let unmatched = false

        for (const lineError of perLine) {
          const reason = lineFailureReason(lineError.errorCode)
          const candidate = submitted[lineError.index]
          /* `index` is the primary key (spec 013 guarantees the order is preserved); the
             tour+date pair is a CHECKSUM on top of it. Both paths only work because a cart id is
             deterministic (`${tourId}:${tourDate}`) — the second reason ADR 022 forbids UUIDs. */
          const matched =
            candidate && candidate.tourId === lineError.tourId && candidate.tourDate === lineError.tourDate
              ? candidate.id
              : submitted.find((item) => item.id === `${lineError.tourId}:${lineError.tourDate}`)?.id

          if (!matched) {
            unmatched = true
            continue
          }
          nextErrors.set(matched, reason)

          if (reason === 'dateUnavailable' || reason === 'datePast') {
            const key = String(lineError.tourId)
            const bucket = nextClosed[key] ?? []
            if (!bucket.includes(lineError.tourDate)) bucket.push(lineError.tourDate)
            nextClosed[key] = bucket
          }
        }

        setLineErrors(nextErrors)
        /* `formError` stays null when every reported line found its row: the reasons are already
           visible on the rows, and repeating them in a banner would say the same thing twice. A
           line we could NOT place is the one case that needs a general message — otherwise the
           submit button would stay blocked with nothing on screen explaining why. */
        setFormError(unmatched ? checkoutFormMessage(err, t) : null)

        if (Object.keys(nextClosed).length > 0) {
          setServerClosed((prev) => {
            const merged: Record<string, readonly string[]> = { ...prev }
            for (const [tourId, dates] of Object.entries(nextClosed)) {
              const existing = merged[tourId] ?? []
              merged[tourId] = [...existing, ...dates.filter((date) => !existing.includes(date))]
            }
            return merged
          })
        }
      } finally {
        inFlight.current = false
        setRunning(false)
      }
    },
    [t],
  )

  return { running, lineErrors, formError, result, authNotice, serverClosed, submit, clearLineError }
}
