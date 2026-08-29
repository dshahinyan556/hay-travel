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
 *  - at least one route point (with RU text) in every day / in the excursion,
 *  - a format for a Tour/Excursion, plus a positive per-person price and seat count whenever
 *    that format is Group or Both (батч 2026-08-29),
 *  - at least one start time for a Tour/Excursion, each filled in and non-duplicate,
 *  - for a Transfer: an "откуда" and a "куда" (RU), no blank stops, and at least one price row
 *    with a distinct vehicle class and two positive prices.
 * Everything else (EN translations, short/full descriptions, durations, lists, expenses) is
 * optional and never blocks saving.
 *
 * Every rule that is type- or format-dependent mirrors one the backend enforces too
 * (`TourValidationService`: `InvalidGroupPricing`/2051, `InvalidTourStartTimes`/2052) — the point
 * of duplicating them here is a message next to the field instead of a 400 after a round trip.
 */

import { TourFormat, TourType } from '@/features/admin/lib/enums'
import type { TourFormState, TourDayFormState } from '@/features/admin/types/form'
import { MIN_TOUR_DAYS } from '@/features/admin/tour-form/reducer/tourFormReducer'
import type { TourFormCopy } from '@/features/admin/tour-form/lib/tourFormCopy'

/** The messages this module hands back. It stays pure: the caller (`useTourForm`, which has the
 * locale) resolves the copy and passes this section in, rather than the validator returning error
 * codes every consumer would then have to map back to text. */
export type ValidationCopy = TourFormCopy['validation']

/** Per-row errors of the transfer's price table — three independently checkable cells. */
export interface TransferPriceRowErrors {
  vehicleClassId?: string
  oneWayPrice?: string
  roundTripPrice?: string
}

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
  /** Error for the product format — a tour/excursion cannot be saved without one. */
  format?: string
  /** Error for the group per-person price (missing or non-positive at Group/Both). */
  groupPricePerPerson?: string
  /** Error for the seats-per-departure count (missing or non-positive at Group/Both). */
  groupCapacity?: string
  /** Error for the start-time list as a whole (a tour/excursion needs at least one). */
  startTimes?: string
  /** Per-row start-time errors, keyed by row `key`: an empty slot or a duplicate of another. */
  startTimeErrors: Record<string, string | undefined>
  /** Error for the transfer's "откуда" point (RU text missing). */
  transferFrom?: string
  /** Error for the transfer's "куда" point (RU text missing). */
  transferTo?: string
  /** Per-stop errors of the transfer route, keyed by stop `key` (a stop left blank entirely). */
  transferStopErrors: Record<string, string | undefined>
  /** Error for the transfer's price table as a whole (needs at least one row). */
  transferPrices?: string
  /** Per-row errors of the transfer's price table, keyed by row `key`. */
  transferPriceErrors: Record<string, TransferPriceRowErrors>
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

/** True when the raw input parses to a number strictly greater than zero. Empty, non-numeric and
 * zero/negative all fail — the three cases the "положительное число" message covers. */
function isPositive(raw: string): boolean {
  const n = Number(raw.trim().replace(',', '.'))
  return Number.isFinite(n) && n > 0
}

/** Same as `isPositive`, but rejects fractions too (seats are whole units). */
function isPositiveInteger(raw: string): boolean {
  const trimmed = raw.trim()
  return /^\d+$/.test(trimmed) && Number(trimmed) > 0
}

/** A bilingual list item counts as filled when its RU text is set — the same rule day route
 * points already use (EN stays optional everywhere in this form). */
const hasRuText = (item: { text: { ru: string } }): boolean => item.text.ru.trim() !== ''

export function validateTourForm(state: TourFormState, copy: ValidationCopy): TourFormValidation {
  const isExcursion = state.type === TourType.Excursion
  const isTransfer = state.type === TourType.Transfer

  const titleRu = state.title.ru.trim() === '' ? copy.required : undefined
  const mainImageUrl = state.mainImageUrl.trim() === '' ? copy.mainImageUrl : undefined

  const days =
    state.type === TourType.Tour && state.days.length < MIN_TOUR_DAYS
      ? copy.minDays(MIN_TOUR_DAYS)
      : undefined

  const dayTitleErrors: Record<string, string | undefined> = {}
  const dayPriceErrors: Record<string, string | undefined> = {}
  const dayRoutePointErrors: Record<string, string | undefined> = {}

  for (const day of state.days) {
    // The excursion's single day inherits the tour's title, so it is never validated on its own.
    if (!isExcursion && day.title.ru.trim() === '') dayTitleErrors[day.key] = copy.required
    if (priceValue(day.price) < 0) dayPriceErrors[day.key] = copy.negativePrice
    if (!hasRoutePoint(day)) dayRoutePointErrors[day.key] = copy.noRoutePoint
  }

  /* ---- format + group pricing (тур/экскурсия; у трансфера формата нет вовсе) ---- */
  const format = !isTransfer && state.format == null ? copy.required : undefined
  const isGrouped =
    !isTransfer && (state.format === TourFormat.Group || state.format === TourFormat.Both)
  // Обе цифры обязательны и строго положительны при Group/Both. При Individual поля скрыты, а
  // мэппер отправляет null — бэк иначе вернёт InvalidGroupPricing/2051.
  const groupPricePerPerson =
    isGrouped && !isPositive(state.groupPricePerPerson) ? copy.positiveNumber : undefined
  const groupCapacity =
    isGrouped && !isPositiveInteger(state.groupCapacity) ? copy.positiveSeats : undefined

  /* ---- start times (тур/экскурсия; у трансфера их нет) ---- */
  const startTimeErrors: Record<string, string | undefined> = {}
  let startTimes: string | undefined
  if (!isTransfer) {
    if (state.startTimes.length === 0) startTimes = copy.noStartTime
    const seen = new Set<string>()
    for (const slot of state.startTimes) {
      if (slot.time === '') {
        startTimeErrors[slot.key] = copy.required
        continue
      }
      // Дубли отклоняет и бэк (InvalidTourStartTimes/2052) — помечаем второе и последующие
      // вхождения, чтобы было понятно, какую именно строку убрать.
      if (seen.has(slot.time)) startTimeErrors[slot.key] = copy.duplicateStartTime
      seen.add(slot.time)
    }
  }

  /* ---- transfer: route + price table ---- */
  let transferFrom: string | undefined
  let transferTo: string | undefined
  let transferPrices: string | undefined
  const transferStopErrors: Record<string, string | undefined> = {}
  const transferPriceErrors: Record<string, TransferPriceRowErrors> = {}
  if (isTransfer) {
    if (!hasRuText(state.transferFrom)) transferFrom = copy.required
    if (!hasRuText(state.transferTo)) transferTo = copy.required
    for (const stop of state.transferStops) {
      // Пустая остановка — это забытая строка, а не «нет остановок»: их всегда можно удалить.
      if (!hasRuText(stop)) transferStopErrors[stop.key] = copy.required
    }

    if (state.transferPrices.length === 0) transferPrices = copy.noTransferPrice
    const seenClasses = new Set<number>()
    for (const row of state.transferPrices) {
      const rowErrors: TransferPriceRowErrors = {}
      if (row.vehicleClassId == null) {
        rowErrors.vehicleClassId = copy.required
      } else if (seenClasses.has(row.vehicleClassId)) {
        rowErrors.vehicleClassId = copy.duplicateVehicleClass
      } else {
        seenClasses.add(row.vehicleClassId)
      }
      if (!isPositive(row.oneWayPrice)) rowErrors.oneWayPrice = copy.positiveNumber
      // Цена «туда-обратно» — самостоятельное число, а не удвоенная односторонняя (решение 0.6),
      // поэтому проверяется отдельно и так же строго.
      if (!isPositive(row.roundTripPrice)) rowErrors.roundTripPrice = copy.positiveNumber
      if (Object.keys(rowErrors).length > 0) transferPriceErrors[row.key] = rowErrors
    }
  }

  // Все три поля (процент + начало + окончание) заданы вместе или пусты все три, и начало
  // не позже окончания — тот же набор правил, что TourValidationService.ValidateDiscount
  // на бэке (ErrorCode 2025). Даты в ISO `YYYY-MM-DD` сравниваются как строки. У трансфера
  // скидки нет вообще — поля скрыты, а мэппер отправляет null, так что проверять нечего.
  const discountStart = state.discountStartDate.trim()
  const discountEnd = state.discountValidUntil.trim()
  const hasDiscountPercent = state.discountPercent.trim() !== ''
  const hasDiscountStartDate = discountStart !== ''
  const hasDiscountValidUntil = discountEnd !== ''
  let discountPercent: string | undefined
  let discountStartDate: string | undefined
  let discountValidUntil: string | undefined
  if (!isTransfer && (hasDiscountPercent || hasDiscountStartDate || hasDiscountValidUntil)) {
    if (!hasDiscountStartDate) discountStartDate = copy.discountNeedsStartDate
    if (!hasDiscountValidUntil) discountValidUntil = copy.discountNeedsValidUntil
    if (!hasDiscountPercent) {
      discountPercent = copy.discountNeedsPercent
    } else {
      const n = Number(state.discountPercent.trim().replace(',', '.'))
      if (!Number.isFinite(n) || n <= 0 || n > 100) discountPercent = copy.discountRange
    }
    // Равенство разрешено — однодневная акция.
    if (hasDiscountStartDate && hasDiscountValidUntil && discountStart > discountEnd) {
      discountStartDate = copy.discountStartAfterEnd
    }
  }

  const isValid =
    !titleRu &&
    !mainImageUrl &&
    !days &&
    !discountPercent &&
    !discountStartDate &&
    !discountValidUntil &&
    !format &&
    !groupPricePerPerson &&
    !groupCapacity &&
    !startTimes &&
    !transferFrom &&
    !transferTo &&
    !transferPrices &&
    Object.keys(dayTitleErrors).length === 0 &&
    Object.keys(dayPriceErrors).length === 0 &&
    Object.keys(dayRoutePointErrors).length === 0 &&
    Object.keys(startTimeErrors).length === 0 &&
    Object.keys(transferStopErrors).length === 0 &&
    Object.keys(transferPriceErrors).length === 0

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
    format,
    groupPricePerPerson,
    groupCapacity,
    startTimes,
    startTimeErrors,
    transferFrom,
    transferTo,
    transferStopErrors,
    transferPrices,
    transferPriceErrors,
    isValid,
  }
}
