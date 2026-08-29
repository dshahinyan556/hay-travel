import { MAX_GUESTS, resolveEffectiveFormat, seatsLeftOn } from '@/shared/booking'
import { isReturnLegValid, type CartItem } from '@/shared/cart'
import type { TourDetail } from '@/shared/types/tour'
import type { TransferDetail, TransferVehicleOption } from '@/shared/types/transfer'
import type { TourGroupSeatsModel } from '@/shared/types/booking'
import { TourFormat, type EffectiveTourFormat } from '@/shared/types/tourFormat'

/**
 * Что известно про одну позицию корзины ПОМИМО того, что лежит в localStorage: по какому
 * тарифу её считать и можно ли её вообще отправить (батч 2026-08-29).
 *
 * Живёт отдельным модулем, потому что ответ нужен ДВУМ местам сразу и они обязаны совпадать:
 * `CartLineCard` рисует по нему цену и сообщение, а `CartPage` решает, блокировать ли кнопку
 * отправки. Разъехавшись, эта пара дала бы худший из возможных вариантов — красную строку при
 * активной кнопке «Отправить» (или наоборот).
 *
 * Ничего не мутирует и ничего не запрашивает: чистая функция от позиции + свежего продукта +
 * ответа `GetGroupSeats`.
 */

/** Причина, по которой позицию нельзя отправить. Клиентская: сервер проверяет ровно то же
 * (2044/2046) — здесь это UX, чтобы отказ не прилетал после нажатия кнопки. */
export type CartLineIssue =
  /** Продукт стал продаваться в обоих форматах уже после добавления — выбора в позиции нет. */
  | 'formatRequired'
  /** На выбранном выезде мест не осталось вовсе. */
  | 'noSeats'
  /** Мест меньше, чем гостей в позиции. */
  | 'notEnoughSeats'
  /* ── Только у позиции-трансфера (батч 2026-08-29) ─────────────────────────────────────────
     Все три означают одно: выбор, сделанный на странице трансфера, разошёлся с тем, что там
     сейчас. Чинятся они ТАМ ЖЕ — в корзине класс авто и обратный рейс не редактируются. */
  /** Класс авто больше не продаётся на этом трансфере (админ убрал строку цены) — 2047. */
  | 'vehicleUnavailable'
  /** Пассажиров больше, чем вмещает выбранный класс — 2049. */
  | 'passengersOverCapacity'
  /** Обратный рейс оказался раньше самой поездки — 2058. */
  | 'returnTripInvalid'

export interface CartLineState {
  /** `null` — формат не разрешается (`formatRequired`): считать цену не по чему. Также `null`
   * у позиции-трансфера: формата у неё нет ни на продукте, ни в теле заказа. */
  format: EffectiveTourFormat | null
  /** Свободные места на выезд позиции; `null` — ограничителя нет или он неизвестен. */
  seatsLeft: number | null
  issue: CartLineIssue | null
  /** Класс авто позиции-трансфера с ЕГО ЦЕНАМИ (свежими, из `GetTransferInfo`) — цена строки
   * считается по ним, а не по числу, замороженному в localStorage. `null` у брони продукта и у
   * трансфера, чей класс больше не продаётся. */
  vehicle: TransferVehicleOption | null
}

/**
 * Позиция-трансфер (решение 0.10). Отдельная функция, а не ветка внутри `resolveCartLine`:
 * общего у них ровно ноль — ни формата, ни мест, ни тиров по гостям. Ветвление здесь было бы
 * двумя несвязанными функциями, склеенными через `if`.
 *
 * Порядок проверок повторяет серверный (`OrderValidationService.ValidateTransferLine`): сначала
 * обратный рейс, потом класс, потом вместимость.
 */
export function resolveTransferCartLine(item: CartItem, transfer: TransferDetail): CartLineState {
  const selection = item.transfer
  // Недостижимо: вызывается только для позиций с `transfer !== null`. Но возвращать «всё хорошо»
  // на позиции без выбора нельзя — цены у неё нет.
  if (selection === null) {
    return { format: null, seatsLeft: null, issue: 'vehicleUnavailable', vehicle: null }
  }

  if (!isReturnLegValid(item.tourDate, item.startTime, selection)) {
    return { format: null, seatsLeft: null, issue: 'returnTripInvalid', vehicle: null }
  }

  const vehicle =
    transfer.vehicles.find((option) => option.vehicleClassId === selection.vehicleClassId) ?? null
  if (vehicle === null) {
    return { format: null, seatsLeft: null, issue: 'vehicleUnavailable', vehicle: null }
  }

  /* Вместимость класса — это и есть «сколько мест осталось» у трансфера: пул мест общий с
     машиной, а не с выездом, и делить его не с кем. Но у строки ПО ПРОДУКТУ есть и второй
     потолок — `MAX_GUESTS` (2015), поэтому предел это минимум из двух. */
  const capacity = Math.min(vehicle.capacity, MAX_GUESTS)

  return {
    format: null,
    seatsLeft: capacity,
    issue: item.guestCount > capacity ? 'passengersOverCapacity' : null,
    vehicle,
  }
}

export function resolveCartLine(
  item: CartItem,
  tour: TourDetail,
  groupSeats: TourGroupSeatsModel | null,
): CartLineState {
  const format = resolveEffectiveFormat(tour.format, item.format)
  if (format === null)
    return { format: null, seatsLeft: null, issue: 'formatRequired', vehicle: null }

  /* Места ограничивают ТОЛЬКО групповую бронь. У продукта с обоими форматами пул мест
     существует, но к посетителю, который едет индивидуально, отношения не имеет — тот же
     порядок проверок, что у `OrderValidationService` (сначала формат, потом места). */
  const seatsLeft = format === TourFormat.Group ? seatsLeftOn(groupSeats, item.tourDate, item.startTime) : null
  if (seatsLeft === null) return { format, seatsLeft: null, issue: null, vehicle: null }

  return {
    format,
    seatsLeft,
    issue: seatsLeft === 0 ? 'noSeats' : item.guestCount > seatsLeft ? 'notEnoughSeats' : null,
    vehicle: null,
  }
}
