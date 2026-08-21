/**
 * Derived, pure validation for the tour form. Takes the current form state and returns the
 * set of blocking errors — it holds no state and never mutates. The form is submittable only
 * when `isValid` is true.
 *
 * Required (blocking) fields, matching the design mockup's `*` markers and the domain rules:
 *  - the tour's RU title,
 *  - the main image URL,
 *  - each day's RU title (a Tour only — an Excursion's single day inherits the tour's texts,
 *    so it is never edited or validated separately),
 *  - at least two days for a Tour (Excursions are always exactly one),
 *  - a non-negative price for every day,
 *  - at least one route point (with RU text) in every day / in the excursion.
 * Everything else (EN translations, short/full descriptions, durations, lists, expenses) is
 * optional and never blocks saving.
 */

import { TourType } from '@/features/admin/lib/enums'
import type { TourFormState, TourDayFormState } from '@/features/admin/types/form'
import { MIN_TOUR_DAYS } from '@/features/admin/tour-form/reducer/tourFormReducer'

const REQUIRED = 'Обязательное поле'
const NEGATIVE_PRICE = 'Цена не может быть отрицательной'
const NO_ROUTE_POINT = 'Добавьте хотя бы одну точку маршрута'
const DISCOUNT_RANGE = 'Введите процент от 0 до 100'
const DISCOUNT_NEEDS_DATE = 'Укажите дату, до которой действует скидка'
const DISCOUNT_NEEDS_START_DATE = 'Укажите дату начала скидки'
const DISCOUNT_NEEDS_PERCENT = 'Укажите размер скидки'
const DISCOUNT_START_AFTER_END = 'Дата начала не может быть позже даты окончания'

export interface TourFormValidation {
  /** Error for the tour's RU title, if empty. */
  titleRu?: string
  /** Error for the main image URL, if empty. */
  mainImageUrl?: string
  /** Error for the day count (a Tour needs at least two days). */
  days?: string
  /** RU-title errors per day, keyed by `day.key`. Absent key = that day is fine. */
  dayTitleErrors: Record<string, string | undefined>
  /** Negative-price errors per day, keyed by `day.key`. */
  dayPriceErrors: Record<string, string | undefined>
  /** Missing-route-point errors per day, keyed by `day.key`. */
  dayRoutePointErrors: Record<string, string | undefined>
  /** Error for the discount percent — bad range, or a discount date without it. */
  discountPercent?: string
  /** Error for the discount start date — missing while the rest of the discount is set, or
   * later than the valid-until date. */
  discountStartDate?: string
  /** Error for the discount valid-until date — missing while the rest of the discount is set. */
  discountValidUntil?: string
  /** True only when there are no blocking errors. */
  isValid: boolean
}

/** A day needs at least one route point whose RU text is non-empty. */
function hasRoutePoint(day: TourDayFormState): boolean {
  return day.routePoints.some((rp) => rp.text.ru.trim() !== '')
}

/** Parse a user-entered price; empty/invalid counts as 0 (not negative). */
function priceValue(raw: string): number {
  const n = Number(raw.trim().replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export function validateTourForm(state: TourFormState): TourFormValidation {
  const isExcursion = state.type === TourType.Excursion

  const titleRu = state.title.ru.trim() === '' ? REQUIRED : undefined
  const mainImageUrl = state.mainImageUrl.trim() === '' ? 'Укажите ссылку на главную картинку' : undefined

  const days =
    state.type === TourType.Tour && state.days.length < MIN_TOUR_DAYS
      ? `Для тура нужно минимум ${MIN_TOUR_DAYS} дня`
      : undefined

  const dayTitleErrors: Record<string, string | undefined> = {}
  const dayPriceErrors: Record<string, string | undefined> = {}
  const dayRoutePointErrors: Record<string, string | undefined> = {}

  for (const day of state.days) {
    // The excursion's single day inherits the tour's title, so it is never validated on its own.
    if (!isExcursion && day.title.ru.trim() === '') dayTitleErrors[day.key] = REQUIRED
    if (priceValue(day.price) < 0) dayPriceErrors[day.key] = NEGATIVE_PRICE
    if (!hasRoutePoint(day)) dayRoutePointErrors[day.key] = NO_ROUTE_POINT
  }

  // Все три поля (процент + начало + окончание) заданы вместе или пусты все три, и начало
  // не позже окончания — тот же набор правил, что TourValidationService.ValidateDiscount
  // на бэке (ErrorCode 2025). Даты в ISO `YYYY-MM-DD` сравниваются как строки.
  const discountStart = state.discountStartDate.trim()
  const discountEnd = state.discountValidUntil.trim()
  const hasDiscountPercent = state.discountPercent.trim() !== ''
  const hasDiscountStartDate = discountStart !== ''
  const hasDiscountValidUntil = discountEnd !== ''
  let discountPercent: string | undefined
  let discountStartDate: string | undefined
  let discountValidUntil: string | undefined
  if (hasDiscountPercent || hasDiscountStartDate || hasDiscountValidUntil) {
    if (!hasDiscountStartDate) discountStartDate = DISCOUNT_NEEDS_START_DATE
    if (!hasDiscountValidUntil) discountValidUntil = DISCOUNT_NEEDS_DATE
    if (!hasDiscountPercent) {
      discountPercent = DISCOUNT_NEEDS_PERCENT
    } else {
      const n = Number(state.discountPercent.trim().replace(',', '.'))
      if (!Number.isFinite(n) || n <= 0 || n > 100) discountPercent = DISCOUNT_RANGE
    }
    // Равенство разрешено — однодневная акция.
    if (hasDiscountStartDate && hasDiscountValidUntil && discountStart > discountEnd) {
      discountStartDate = DISCOUNT_START_AFTER_END
    }
  }

  const isValid =
    !titleRu &&
    !mainImageUrl &&
    !days &&
    !discountPercent &&
    !discountStartDate &&
    !discountValidUntil &&
    Object.keys(dayTitleErrors).length === 0 &&
    Object.keys(dayPriceErrors).length === 0 &&
    Object.keys(dayRoutePointErrors).length === 0

  return {
    titleRu,
    mainImageUrl,
    days,
    dayTitleErrors,
    dayPriceErrors,
    dayRoutePointErrors,
    discountPercent,
    discountStartDate,
    discountValidUntil,
    isValid,
  }
}
