/**
 * «Сколько мест осталось» на выбранный выезд (решения 0.19/0.20 чек-листа 2026-08-29).
 *
 * Ёмкость — ОДНО число на весь продукт, а занятость считается на пару (дата + время старта):
 * один и тот же продукт 12-го в 09:00 и 12-го в 14:00 — два разных выезда с независимыми
 * местами. Поэтому «осталось» невозможно спросить у продукта, только у слота.
 *
 * Разбор ответа живёт здесь, а не в компоненте, из-за одного неочевидного места контракта:
 * в `slots` попадают ТОЛЬКО слоты с бронями, и отсутствие даты означает «свободно всё», а не
 * «выезда нет». Компонент, который об этом забудет, покажет «мест нет» на пустом расписании.
 */

import { TourFormat } from '@/shared/types/tourFormat'
import type { TourGroupSeatsModel } from '@/shared/types/booking'
import { toDisplayTime } from './startTime'

/**
 * Свободные места на (дата + время старта), либо `null` — «ограничителя нет или он неизвестен».
 *
 * `null` возвращается в трёх случаях, и все три означают «не мешать посетителю бронировать»:
 *  - `seats === null` — запрос не удался (лоадер глотает ошибку: доступность не должна ронять
 *    страницу). Сервер всё равно проверит места при создании заказа (`NoSeatsLeft`/2044);
 *  - у продукта нет группового формата — считать по местам нечего;
 *  - дата или время ещё не выбраны — слот не адресуется.
 *
 * Число — уже готовое «осталось», не может быть отрицательным. Ноль — «на этот выезд мест
 * нет», и это ОТКАЗ, а не «неизвестно»: у группового продукта нулевая ёмкость означала бы, что
 * бронировать нельзя вовсе, ровно так же считает и `OrderValidationService`.
 */
export function seatsLeftOn(
  seats: TourGroupSeatsModel | null,
  dateISO: string,
  startTime: string,
): number | null {
  if (seats === null) return null
  if (seats.format !== TourFormat.Group && seats.format !== TourFormat.Both) return null
  if (dateISO === '' || startTime === '') return null

  const slot = seats.slots.find(
    (candidate) => candidate.date.slice(0, 10) === dateISO && toDisplayTime(candidate.startTime) === startTime,
  )
  return Math.max(slot === undefined ? seats.capacity : slot.seatsLeft, 0)
}
