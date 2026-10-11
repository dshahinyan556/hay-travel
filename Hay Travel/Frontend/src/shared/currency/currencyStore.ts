/**
 * The currency store: a module-level observable, deliberately OUTSIDE React (ADR 009).
 *
 * Why a module and not a Context — and note this is NOT ADR 007's loader argument, which does not
 * apply here (no loader reads the currency: prices arrive in AMD and are converted client-side):
 *  - the rate table is a process-wide singleton with a single-flight fetch and a localStorage
 *    mirror. That is module state by nature; a provider would be a thin wrapper over the same
 *    module and would have to be mounted in two independent route trees (`RootLayout` and
 *    `/admin`) or hoisted above both;
 *  - one store idiom per codebase — `shared/auth` is already a module store + `useSyncExternalStore`;
 *  - it stays readable from non-React code for free.
 *
 * IMPORTANT — changing the currency does NOT revalidate loaders. `useRevalidateOnLocaleChange` must
 * never grow a currency counterpart "for symmetry": tour data is fetched in AMD and stays valid;
 * only the client-side formatting of it changes.
 *
 * Two localStorage keys, two different jobs:
 *  1. `hay-travel-currency` — the visitor's preference (a plain code string);
 *  2. `hay-travel-rates`    — a ≤24h SEED of the last successful response, so a returning visitor
 *     whose preference is USD gets the FIRST PAINT already in USD instead of watching every price
 *     on the page change ~200ms later. It is overwritten by the live response as soon as that
 *     lands, and the backend's own policy already serves rates up to 3h old (sync-doc §4), so a
 *     ≤24h seed introduces no new class of staleness.
 *
 * Both storage paths are wrapped in try/catch (Safari private mode, blocked storage): a storage
 * failure degrades to "AMD for this session", it never throws.
 */

import { fetchExchangeRates } from './currencyApi'
import type { CurrencyCode, CurrencyRate, CurrencyState, ExchangeRatesModel, RatesStatus } from './types'

const STORAGE_KEY_CURRENCY = 'hay-travel-currency'
const STORAGE_KEY_RATES = 'hay-travel-rates'

/**
 * Базовая валюта каталога. Экспортируется, потому что «личного выбора валюты нет» в предпочтениях
 * аккаунта (`preferredCurrency: null`) означает именно её, и синхронизация с аккаунтом обязана
 * называть ту же валюту, что и стор, а не держать свою копию строки.
 */
export const BASE_CURRENCY_CODE = 'AMD'

/**
 * The ONLY currency constant hardcoded on the frontend.
 *
 * Used exclusively when the endpoint is unreachable or answers 503 `ExchangeRatesUnavailable`
 * (sync-doc §5: "degrade to AMD-only"). Without it `state.active` could not be non-null, and every
 * price in the app would need a null branch for a case that should never reach production.
 */
const AMD_FALLBACK: CurrencyRate = { code: BASE_CURRENCY_CODE, symbol: '֏', ratePerUnitAmd: 1, roundingStep: 100 }

/** Past this age a seeded rate stops being a reasonable guess and becomes junk — start from AMD. */
const SEED_MAX_AGE_MS = 24 * 60 * 60 * 1000
/** Refresh window for a long-lived tab, matching the backend's own 3h staleness rule. */
const RATES_MAX_AGE_MS = 3 * 60 * 60 * 1000

interface RatesSeed {
  fetchedAt: number
  payload: ExchangeRatesModel
}

/* -------------------------------------------------------------------------- */
/*  localStorage                                                               */
/* -------------------------------------------------------------------------- */

function readStoredCurrency(): CurrencyCode {
  try {
    return localStorage.getItem(STORAGE_KEY_CURRENCY) ?? BASE_CURRENCY_CODE
  } catch {
    return BASE_CURRENCY_CODE
  }
}

function writeStoredCurrency(code: CurrencyCode): void {
  try {
    localStorage.setItem(STORAGE_KEY_CURRENCY, code)
  } catch {
    /* ignore — the choice still applies for this tab */
  }
}

/**
 * Rows that survive a hand-edited (or version-skewed) seed. A row with a non-positive rate would
 * produce `Infinity`/`NaN` in every price on the page, so it is dropped here rather than guarded
 * at each of the call sites.
 */
function sanitizeRates(rates: unknown): CurrencyRate[] {
  if (!Array.isArray(rates)) return []
  return rates.flatMap((row: unknown) => {
    if (typeof row !== 'object' || row === null) return []
    const { code, symbol, ratePerUnitAmd, roundingStep } = row as Partial<CurrencyRate>
    if (typeof code !== 'string' || code === '') return []
    if (typeof symbol !== 'string' || symbol === '') return []
    if (typeof ratePerUnitAmd !== 'number' || !Number.isFinite(ratePerUnitAmd) || ratePerUnitAmd <= 0) return []
    if (typeof roundingStep !== 'number' || !Number.isFinite(roundingStep) || roundingStep <= 0) return []
    return [{ code, symbol, ratePerUnitAmd, roundingStep }]
  })
}

function readSeed(): RatesSeed | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RATES)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<RatesSeed>
    if (typeof parsed?.fetchedAt !== 'number' || !parsed.payload) return null
    if (Date.now() - parsed.fetchedAt >= SEED_MAX_AGE_MS) return null
    const rates = sanitizeRates(parsed.payload.rates)
    if (rates.length === 0) return null
    return { fetchedAt: parsed.fetchedAt, payload: { ...parsed.payload, rates } }
  } catch {
    return null
  }
}

function writeSeed(payload: ExchangeRatesModel): void {
  try {
    localStorage.setItem(STORAGE_KEY_RATES, JSON.stringify({ fetchedAt: Date.now(), payload } satisfies RatesSeed))
  } catch {
    /* ignore — the seed is an optimisation, never a requirement */
  }
}

/* -------------------------------------------------------------------------- */
/*  State                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Resolution order for the currency that actually renders:
 * the selected row → the AMD row → the hardcoded AMD fallback.
 *
 * Derived once at write time, never by consumers — that is what keeps every price call site
 * branch-free.
 */
function resolveActive(rates: readonly CurrencyRate[], selectedCode: CurrencyCode): CurrencyRate {
  return (
    rates.find((rate) => rate.code === selectedCode) ??
    rates.find((rate) => rate.code === BASE_CURRENCY_CODE) ??
    AMD_FALLBACK
  )
}

function initialState(): CurrencyState {
  const selectedCode = readStoredCurrency()
  const seed = readSeed()
  const rates = seed ? seed.payload.rates : [AMD_FALLBACK]
  return {
    selectedCode,
    active: resolveActive(rates, selectedCode),
    rates,
    status: 'idle',
    isStale: seed?.payload.isStale ?? false,
    // A seed is NOT a fetch: leaving this at 0 is what makes the first `ensureRatesReady` actually
    // hit the network instead of trusting yesterday's numbers for another 3 hours.
    lastFetchedAt: 0,
  }
}

let state: CurrencyState = initialState()
const listeners = new Set<() => void>()

/** Current snapshot. Referentially stable until something actually changes — `useSyncExternalStore`
 * requires that to avoid an infinite render loop. */
export function getCurrencyState(): CurrencyState {
  return state
}

export function subscribeCurrency(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Replace the snapshot wholesale (never mutate it) and notify subscribers. */
function setState(next: CurrencyState): void {
  state = next
  for (const listener of listeners) listener()
}

/* -------------------------------------------------------------------------- */
/*  Fetching                                                                   */
/* -------------------------------------------------------------------------- */

let ratesPromise: Promise<CurrencyState> | null = null
let inFlight = false

function applyPayload(payload: ExchangeRatesModel): void {
  const rates = sanitizeRates(payload.rates)
  // An empty/garbage `rates[]` is treated like a failed fetch: keep whatever is renderable now
  // rather than replacing a working seed with nothing.
  if (rates.length === 0) {
    setState({ ...state, status: 'error' })
    return
  }
  setState({
    selectedCode: state.selectedCode,
    active: resolveActive(rates, state.selectedCode),
    rates,
    status: 'ready',
    isStale: payload.isStale,
    lastFetchedAt: Date.now(),
  })
  writeSeed({ ...payload, rates })
}

/**
 * Resolve the rate table once per page load, then hand the same answer to every later caller.
 *
 * Single-flight and NEVER rejects: a failed fetch resolves to whatever is renderable (the seed, or
 * AMD-only) with `status: 'error'`, which is what the switcher reads to disable itself.
 */
export function ensureRatesReady(): Promise<CurrencyState> {
  if (ratesPromise) return ratesPromise

  inFlight = true
  ratesPromise = (async () => {
    const status: RatesStatus = 'loading'
    setState({ ...state, status })
    try {
      applyPayload(await fetchExchangeRates())
    } catch {
      // Every failure mode (503 cold start, network, TLS, malformed body) has the same correct
      // answer here: degrade to what we can already render. Prices must never go blank or NaN.
      setState({ ...state, status: 'error' })
    } finally {
      inFlight = false
    }
    return state
  })()

  return ratesPromise
}

/**
 * No-op unless the last SUCCESSFUL fetch is older than `RATES_MAX_AGE_MS`. Fire-and-forget —
 * a tab left open overnight must not keep showing yesterday's rate forever.
 */
export function refreshRatesIfStale(): void {
  if (inFlight) return
  if (state.lastFetchedAt !== 0 && Date.now() - state.lastFetchedAt < RATES_MAX_AGE_MS) return
  ratesPromise = null
  void ensureRatesReady()
}

/* -------------------------------------------------------------------------- */
/*  Preference                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Switch the display currency.
 *
 * A code that is not in `state.rates` (a hand-edited localStorage value, or a currency the backend
 * has since dropped) is IGNORED rather than moving the app into an unrenderable state.
 */
export function setCurrency(code: CurrencyCode): void {
  if (code === state.selectedCode) return
  if (!state.rates.some((rate) => rate.code === code)) return
  writeStoredCurrency(code)
  setState({ ...state, selectedCode: code, active: resolveActive(state.rates, code) })
}

/**
 * Забыть предпочтение и вернуться к базовой валюте.
 *
 * Существует ради выхода из аккаунта: предпочтения залогиненного зеркалятся в этот же ключ (иначе
 * первый кадр следующего захода был бы в чужой валюте), и после выхода они не должны достаться
 * следующему гостю на этом устройстве.
 *
 * Ключ именно УДАЛЯЕТСЯ, а не переписывается на `AMD`: «выбора нет» и «выбран AMD» — разные вещи,
 * и второе пришлось бы потом отличать от первого.
 */
export function clearCurrencyPreference(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_CURRENCY)
  } catch {
    /* ignore — the reset below still applies for this tab */
  }
  if (state.selectedCode === BASE_CURRENCY_CODE) return
  setState({
    ...state,
    selectedCode: BASE_CURRENCY_CODE,
    active: resolveActive(state.rates, BASE_CURRENCY_CODE),
  })
}

/* -------------------------------------------------------------------------- */
/*  Cross-tab + long-lived-tab sync                                            */
/* -------------------------------------------------------------------------- */

// Registered once at module init rather than in a component (mirroring `useTheme`'s precedent, one
// level lower) so it works regardless of what is mounted — including nothing, on `/admin`.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY_CURRENCY) return
    const code = event.newValue ?? BASE_CURRENCY_CODE
    if (code === state.selectedCode) return
    setState({ ...state, selectedCode: code, active: resolveActive(state.rates, code) })
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshRatesIfStale()
  })
}
