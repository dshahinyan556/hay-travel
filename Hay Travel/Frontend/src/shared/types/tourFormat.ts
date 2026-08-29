/**
 * Формат продукта — mirrors backend `TourFormat` (`ATTours.Common/Enums/TourFormat.cs`,
 * батч «Трансферы + формат», 2026-08-29).
 *
 * Собственный leaf-модуль (ничего не импортирует) по образцу `shared/types/employeeRole.ts`:
 * значение нужно ОБЕИМ поверхностям — админке (форма продукта) и публичному сайту (бейдж
 * формата, переключатель в блоке брони, тело `POST api/Order/Create`), — а фича не может
 * импортировать другую фичу. `shared/ui` и `shared/currency` лежат ниже `features`, поэтому
 * тянуть значение из `features/admin/lib/enums.ts` они не могут в принципе.
 *
 * `erasableSyntaxOnly` запрещает TS `enum` — const-объект + union-тип, как везде в проекте.
 *
 * - `Individual` — цена фиксирована за всю бронь, работает тирная наценка 1-4 / 5-6 / 7+
 *   (`shared/currency/pricing.ts`). Ровно то поведение, которое было у всех продуктов до батча.
 * - `Group` — цена ЗА ЧЕЛОВЕКА × гости, без тиров и без «7+ по запросу»; ограничитель —
 *   свободные места на пару (дата + время старта).
 * - `Both` — продукт продаётся и так, и так: формат выбирает клиент в блоке брони, и от этого
 *   выбора зависит цена (`OrderLinePricing.ResolveEffectiveFormat` на бэке).
 *
 * `null` в данных означает две разные вещи, и обе — «считать индивидуальным»: у трансфера
 * формата нет вовсе, у продуктов, созданных до батча, поле не заполнено.
 */
export const TourFormat = {
  Individual: 1,
  Group: 2,
  Both: 3,
} as const

export type TourFormat = (typeof TourFormat)[keyof typeof TourFormat]

/**
 * Формат, по которому реально считается цена одной брони. `Both` сюда попасть не может: это
 * «клиент ещё выбирает», а не тариф — ровно то же различие, что у `ResolveEffectiveFormat`
 * на бэке, где `Both` без выбора клиента даёт `null` и отказ (`OrderLineFormatRequired`/2046).
 */
export type EffectiveTourFormat = typeof TourFormat.Individual | typeof TourFormat.Group
