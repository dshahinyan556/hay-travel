/**
 * Багаж трансфера в «единицах» (решение 0.13).
 *
 * Курс — продуктовое правило, а не эвристика: средний чемодан = 3 единицы, большой = 5. Тот же
 * курс живёт на бэке (`LuggageUnits.Resolve`), и расходиться им нельзя — иначе форма разрешит
 * заявку, которую сервер отобьёт (`LuggageExceedsVehicleCapacity`/2048), и наоборот.
 *
 * «Другое» (коляска, лыжи, велосипед) в единицы НЕ переводится ни здесь, ни на сервере: это
 * свободный текст для менеджера, а не измеримая величина.
 */

/** Сколько единиц занимает один средний чемодан. */
export const LUGGAGE_MEDIUM_UNITS = 3
/** Сколько единиц занимает один большой чемодан. */
export const LUGGAGE_LARGE_UNITS = 5

export interface LuggageCounts {
  medium: number
  large: number
}

export function luggageUnits(counts: LuggageCounts): number {
  return counts.medium * LUGGAGE_MEDIUM_UNITS + counts.large * LUGGAGE_LARGE_UNITS
}

/**
 * Насколько багаж НЕ помещается в класс с лимитом `capacity`; `0` — помещается.
 *
 * Пустой багаж (0/0) проверке не подлежит вовсе — заполнять его не обязательно (решение 0.13),
 * и «клиент про багаж ничего не сказал» это не нарушение. Ровно то же условие стоит на сервере
 * (`luggageUnits > 0 && luggageUnits > vehicleClass.LuggageCapacity`).
 */
export function luggageOverflow(counts: LuggageCounts, capacity: number): number {
  const units = luggageUnits(counts)
  if (units === 0) return 0
  return Math.max(units - capacity, 0)
}
