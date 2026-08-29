/**
 * Публичная модель трансфера (батч «Трансферы + формат», 2026-08-29).
 *
 * Отдельно от `Tour`/`TourDetail` и по той же причине, по которой на бэке отдельные
 * `TransferCardModel`/`TransferInfoModel`: у трансфера нет дней, галереи, регионов, тегов,
 * скидки и длительности. Модель, у которой половина полей всегда пуста, врала бы о контракте и
 * заставляла каждый компонент проверять `null` там, где значения не бывает по определению.
 *
 * Провод (`shared/types/attours.ts`) → эта модель: `shared/api/transfers.ts`, единственный
 * модуль, который знает обе формы.
 *
 * Даты и время здесь не появляются: у самого продукта их нет — есть только маршрут и цены.
 * Дату поездки и время подачи выбирает посетитель в блоке брони.
 */

/** Роль точки в маршруте. Числа `TransferRoutePointKind` бэка (1/2/3) остаются на проводе. */
export type TransferPointKind = 'from' | 'stop' | 'to'

export interface TransferPoint {
  kind: TransferPointKind
  /** Текст точки на языке посетителя. Пустые точки отбрасываются при маппинге. */
  text: string
}

/** Один класс авто с ДВУМЯ ценами этого трансфера. Цена живёт на связке «трансфер × класс»,
 * а не в справочнике: один и тот же минивэн стоит разное на разных маршрутах. */
export interface TransferVehicleOption {
  vehicleClassId: number
  name: string
  /** Пассажирских мест, без водителя. */
  capacity: number
  /** Лимит багажа в «единицах»: средний чемодан = 3, большой = 5 (решение 0.13). */
  luggageCapacity: number
  /** AMD. */
  oneWayPrice: number
  /** AMD. Отдельное поле, а НЕ удвоенная цена в одну сторону (решение 0.6). */
  roundTripPrice: number
}

/** Карточка `/transfers`. */
export interface TransferSummary {
  id: string
  title: string
  coverImage: string
  /** Маршрут целиком, в порядке «откуда → стопы → куда». */
  route: readonly TransferPoint[]
  /** Минимальная цена в одну сторону среди классов, AMD; `null` — цен нет (битые данные:
   * валидация не пропускает трансфер без цен, но публичная страница обязана это пережить). */
  priceFrom: number | null
}

export interface TransferDetail extends TransferSummary {
  /** Показывать ли блок предоплаты — тот же per-product флаг, что у тура. */
  requiresPrepayment: boolean
  /** Классы с ценами, в порядке справочника. Пустой список = забронировать нельзя. */
  vehicles: readonly TransferVehicleOption[]
}

/** Класс авто из общего справочника — для «желаемого класса» в конструкторе заявки, где
 * продукта (а значит и цен) ещё нет. */
export interface VehicleClass {
  id: number
  name: string
  capacity: number
  luggageCapacity: number
}

/** Точка «откуда»/«куда» трансфера — то, чем заполняются фильтры на `/transfers`. */
export function transferPointOf(
  route: readonly TransferPoint[],
  kind: TransferPointKind,
): string {
  return route.find((point) => point.kind === kind)?.text ?? ''
}
