/**
 * Pricing math — PURE. No store, no React, no i18n, no formatting.
 *
 * The stored price (`Tour.TotalPrice`/`TourDay.Price`) is a FLAT price for the booking — for up to
 * 4 guests, not a per-person rate. Guest count only selects which TIER applies; it is never a
 * multiplier. (An earlier version of this file multiplied the tiered amount by guest count, which
 * silently turned every flat group price into a per-person rate — fixed 2026-08-07.)
 *
 * ── Order of operations (non-negotiable) ──────────────────────────────────────────────────────
 *   tier in AMD → apply the prepayment share in AMD → convert ONCE → round ONCE.
 *
 * Never convert first and round the result, and never round twice: rounding happens exactly once,
 * as the last step.
 *
 * The group-tier rule lives HERE and nowhere else (sync-doc §6.4). `useTierPrice`, and anything
 * added later, compose these functions; they never re-express the rule.
 */

import type { CurrencyRate } from './types'

/** 1–4 guests pay the base price. */
export const TIER_BASE_MAX_GUESTS = 4
/** 5–6 guests pay `TIER_SURCHARGE_MULTIPLIER`; 7+ has no displayed price at all. */
export const TIER_SURCHARGE_MAX_GUESTS = 6
export const TIER_SURCHARGE_MULTIPLIER = 1.2

export type PriceTier = 'base' | 'surcharge' | 'hidden'

export function resolveTier(guestCount: number): PriceTier {
  if (guestCount <= TIER_BASE_MAX_GUESTS) return 'base'
  if (guestCount <= TIER_SURCHARGE_MAX_GUESTS) return 'surcharge'
  return 'hidden'
}

export interface TieredPrice {
  tier: PriceTier
  /**
   * AMD after the multiplier. `null` — and only null — when `tier === 'hidden'`, so "there is no
   * price to show" is unrepresentable as a number.
   */
  amountAmd: number | null
}

export function applyGroupTier(amountAmd: number, guestCount: number): TieredPrice {
  const tier = resolveTier(guestCount)
  if (tier === 'hidden') return { tier, amountAmd: null }
  return { tier, amountAmd: tier === 'surcharge' ? amountAmd * TIER_SURCHARGE_MULTIPLIER : amountAmd }
}

/**
 * AMD → target currency, UNROUNDED (sync-doc §6). Returns 0 rather than `Infinity`/`NaN` when the
 * rate is missing or non-positive — a single bad row must not poison every price on the page.
 */
export function convertFromAmd(amountAmd: number, rate: CurrencyRate): number {
  if (!Number.isFinite(amountAmd)) return 0
  if (!Number.isFinite(rate.ratePerUnitAmd) || rate.ratePerUnitAmd <= 0) return 0
  return amountAmd / rate.ratePerUnitAmd
}

/** `Math.round(value / step) * step`; a step of 1 or less is a plain whole-number round. */
export function roundToStep(value: number, step: number): number {
  if (!Number.isFinite(value)) return 0
  if (!Number.isFinite(step) || step <= 1) return Math.round(value)
  return Math.round(value / step) * step
}

/**
 * The full display pipeline: convert → round to `rate.roundingStep` → clamp.
 *
 * Clamp is sync-doc §6's guard rail: if the result is 0 while the AMD amount is positive (possible
 * in RUB with `roundingStep = 100` on a very cheap item), return one step instead of rendering
 * "0 ₽".
 */
export function priceInCurrency(amountAmd: number, rate: CurrencyRate): number {
  const rounded = roundToStep(convertFromAmd(amountAmd, rate), rate.roundingStep)
  if (rounded === 0 && amountAmd > 0) return Math.max(rate.roundingStep, 1)
  return rounded
}

/**
 * AMD → display currency as a whole number, WITHOUT the rounding step.
 *
 * Exists separately from `priceInCurrency` for one call site: the catalog's price-bound inputs.
 * Stepping a value the visitor is actively typing would make the field snap to hundreds mid-word.
 * Paired with `amdFromCurrency` this round trip is stable — both directions are a plain
 * `Math.round`, so `amountInCurrency(amdFromCurrency(x)) === x` for integer `x`.
 */
export function amountInCurrency(amountAmd: number, rate: CurrencyRate): number {
  return Math.round(convertFromAmd(amountAmd, rate))
}

/** Inverse of `amountInCurrency`, for values the visitor types in the display currency. */
export function amdFromCurrency(amount: number, rate: CurrencyRate): number {
  if (!Number.isFinite(amount)) return 0
  if (!Number.isFinite(rate.ratePerUnitAmd) || rate.ratePerUnitAmd <= 0) return 0
  return Math.round(amount * rate.ratePerUnitAmd)
}
