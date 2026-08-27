/**
 * Границы счётчика гостей — общие для `BookingCard` и строки корзины (spec 008 §3).
 *
 * Раньше это были две локальные константы внутри `BookingCard`. С появлением второго живого
 * счётчика (`GuestStepper` в каждой строке `/cart`) они обязаны быть в одном месте: разъехавшиеся
 * границы означали бы, что корзина умеет положить в заказ значение, которое форма тура запрещает.
 */

/** Границы счётчика гостей, общие для BookingCard и строки корзины. Верхняя граница — продуктовое
 *  правило (группы больше 16 бронируются через менеджера), не ограничение бэкенда: сервер
 *  отвергает только заведомо некорректное значение (errorCode 2015). */
export const MIN_GUESTS = 1
export const MAX_GUESTS = 16

/** Приводит любое число (в т.ч. из localStorage) к допустимому целому в [MIN_GUESTS; MAX_GUESTS]. */
export function clampGuests(value: number): number {
  if (!Number.isFinite(value)) return MIN_GUESTS
  const whole = Math.trunc(value)
  if (whole < MIN_GUESTS) return MIN_GUESTS
  if (whole > MAX_GUESTS) return MAX_GUESTS
  return whole
}
