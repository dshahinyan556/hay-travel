/**
 * Формат брони: какой тариф применяется и от какой базовой цены (батч 2026-08-29, решения
 * 0.16-0.18).
 *
 * Это ФРОНТОВАЯ КОПИЯ `OrderLinePricing` (`ATTours.Service/Services/Shared/OrderLinePricing.cs`):
 * TS и C# в этом репозитории кода не делят, а сумма на экране обязана совпадать с суммой
 * заказа до копейки. Порядок операций тот же и переставлять его нельзя:
 *
 *   базовая цена по формату → СКИДКА на дату поездки → формат/тир
 *
 * Живёт в `shared/booking`, а не в `shared/currency`: «сколько стоит» — деньги (`pricing.ts`),
 * «по какому тарифу считать» — правило бронирования. И то, и другое нужно двум фичам сразу
 * (`features/tours` — блок брони, `features/cart` — строка и итог), а фичи не импортируют
 * друг друга.
 */

import { applyGroupTier, applyPerPersonPrice, type TieredPrice } from '@/shared/currency'
import type { Tour } from '@/shared/types/tour'
import { TourFormat, type EffectiveTourFormat } from '@/shared/types/tourFormat'

/**
 * Формат, по которому реально считается бронь.
 *
 * `productFormat` — что задал админ, `chosenFormat` — что выбрал посетитель в блоке брони.
 * Выбор клиента учитывается ТОЛЬКО когда продукт продаётся в обоих форматах: у продукта с
 * фиксированным форматом переопределить его нельзя, и присланное значение бэк тоже игнорирует.
 *
 * `null` означает ровно одно: продукт продаётся в обоих, а формат не выбран. Это отказ
 * (`OrderLineFormatRequired`/2046 на бэке), а НЕ повод молча посчитать по индивидуальному —
 * иначе экран показал бы одну цену, а заказ создался бы по другой.
 *
 * `productFormat === null` (трансфер, либо продукт, созданный до батча) — индивидуальный:
 * ровно то поведение, которое у таких записей было всегда.
 */
export function resolveEffectiveFormat(
  productFormat: TourFormat | null,
  chosenFormat: TourFormat | null,
): EffectiveTourFormat | null {
  if (productFormat === TourFormat.Both) {
    return chosenFormat === TourFormat.Individual || chosenFormat === TourFormat.Group
      ? chosenFormat
      : null
  }
  return productFormat === TourFormat.Group ? TourFormat.Group : TourFormat.Individual
}

/**
 * Базовая цена ДО скидки и ДО тира: за всю бронь (индивидуальный) либо за одного человека
 * (групповой). Зеркало `OrderLinePricing.ResolveBasePrice`.
 *
 * `groupPricePerPerson` у группового продукта обязательна (валидация продукта не даст
 * сохранить его без неё), но приходит с бэка nullable — `?? 0` повторяет ту же подстановку,
 * что делает C#: цена 0 честнее, чем `NaN` на экране.
 */
export function resolveBasePrice(
  format: EffectiveTourFormat,
  totalPriceAmd: number,
  groupPricePerPersonAmd: number | null,
): number {
  return format === TourFormat.Group ? (groupPricePerPersonAmd ?? 0) : totalPriceAmd
}

/**
 * Итог брони от УЖЕ дисконтированной базовой цены. Зеркало `OrderLinePricing.ResolveLineTotal`.
 *
 * Групповой: цена за человека × гости, без тиров и без «7+ скрыто» — то есть `amountAmd`
 * никогда не `null`, и ветка «цена по запросу» в групповом формате недостижима.
 * Индивидуальный: тир 1-4 / 5-6 / 7+ ровно в том виде, в каком он существовал до батча.
 */
export function applyFormatPricing(
  format: EffectiveTourFormat,
  discountedBasePriceAmd: number,
  guestCount: number,
): TieredPrice {
  return format === TourFormat.Group
    ? { tier: 'base', amountAmd: applyPerPersonPrice(discountedBasePriceAmd, guestCount) }
    : applyGroupTier(discountedBasePriceAmd, guestCount)
}

/* -------------------------------------------------------------------------- */
/*  Витрина: какой ценой продукт представлен в каталоге                        */
/* -------------------------------------------------------------------------- */

/** Поля, которых достаточно, чтобы назвать витринную цену. `Pick`, а не `Tour`, чтобы функция
 * одинаково принимала и карточку (`Tour`), и детальную (`TourDetail`). */
type CatalogPriced = Pick<Tour, 'format' | 'priceFrom' | 'groupPricePerPerson'>

/**
 * Продукт, чья ВИТРИННАЯ цена — за человека.
 *
 * Только чисто групповой: у `Both` цена за бронь настоящая и остаётся главной («от»), а какой
 * из двух тарифов применится, решает посетитель уже в блоке брони.
 */
export function isPerPersonPricing(tour: CatalogPriced): boolean {
  return tour.format === TourFormat.Group && tour.groupPricePerPerson !== null
}

/**
 * Цена, которой продукт представлен в каталоге, AMD.
 *
 * Одна функция на КАРТОЧКУ и на ФИЛЬТР/СОРТИРОВКУ по цене — иначе «до 20 000» отбрасывало бы
 * карточку с ценником 8 000 (у группового продукта `priceFrom` это сумма цен дней, которую
 * клиент не платит, — решение 0.26).
 *
 * Скидка сюда не входит: фильтр каталога всегда работал по базовой цене продукта, и этот батч
 * того правила не менял.
 */
export function catalogBasePrice(tour: CatalogPriced): number {
  const perPerson = tour.groupPricePerPerson
  return tour.format === TourFormat.Group && perPerson !== null ? perPerson : tour.priceFrom
}
