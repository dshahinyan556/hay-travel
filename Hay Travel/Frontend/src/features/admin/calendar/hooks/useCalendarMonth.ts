/**
 * Month data for the availability calendar — owned by this hook, NOT by the route loader.
 *
 * Every other admin screen loads through a `loader` + `useLoaderData` + `revalidator`. This one
 * deliberately does not, and the reasoning is ADR 016 in full: a loader fetches on NAVIGATION,
 * while paging months with the arrows is not navigation — the admin flips through a dozen months
 * in seconds without leaving the screen. Putting the month in the URL would re-run the loader (and
 * with it the tour and rule lists, which do not depend on the month), turn Back into "previous
 * month" instead of "leave the screen", and re-fetch a month the user just looked at.
 *
 * So: the month is local state in `CalendarPage`, and this hook keeps a small in-memory cache with
 * request de-duplication, cancellation and a one-month lookahead prefetch. `calendarLoader` still
 * owns everything that is month-independent (tours, rules) through the normal loader path, so the
 * two mechanisms never hold the same data.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { endOfMonth, formatISODate, startOfMonth } from '@/shared/lib/date'
import { getCalendarMonth } from '@/features/admin/api/adminAvailability'
import { getOrders } from '@/features/admin/api/adminOrders'
import { OrderStatus, type CalendarMonthModel, type OrderInfoModel } from '@/shared/types/booking'
import { monthKey } from '../lib/calendarModel'

export interface MonthBundle {
  calendar: CalendarMonthModel
  /**
   * Every order of the month, minus cancelled ones — filtered HERE so the day panel agrees with
   * the grid counters, which the server already computes without cancelled orders.
   */
  orders: OrderInfoModel[]
}

export interface UseCalendarMonthResult {
  data: MonthBundle | null
  isLoading: boolean
  error: unknown
  /** Drops the whole cache and reloads the current month. Call after any rule mutation. */
  invalidateAll: () => void
  /** Retry after a failure. */
  retry: () => void
}

/** Both requests for one month, in one round trip. Fetching orders for the whole month (rather
 * than per opened day) is what lets the day panel open with no network at all — see ADR 016 for
 * the ~500-orders-a-month threshold at which that trade flips. */
async function fetchMonth(year: number, month: number, signal: AbortSignal): Promise<MonthBundle> {
  const first = new Date(year, month - 1, 1)
  const from = formatISODate(startOfMonth(first))
  const to = formatISODate(endOfMonth(first))

  const [calendar, orders] = await Promise.all([
    getCalendarMonth(year, month, signal),
    getOrders({ from, to }, signal),
  ])
  return { calendar, orders: orders.filter((order) => order.status !== OrderStatus.Cancelled) }
}

/** @param month 1..12. */
export function useCalendarMonth(year: number, month: number): UseCalendarMonthResult {
  const cache = useRef<Map<string, MonthBundle>>(new Map())
  /** In-flight requests by key, so two effects (or an effect and the prefetch) never fire the same
   * month twice. */
  const inFlight = useRef<Map<string, Promise<MonthBundle>>>(new Map())
  /** The key the user is actually looking at. A response for anything else may land in the cache
   * but must not become `data` — that is the "pages faster than the network" race. */
  const currentKey = useRef('')
  /** Bumped by `retry`/`invalidateAll` to re-run the effect without changing the month. */
  const [reloadToken, setReloadToken] = useState(0)

  const [data, setData] = useState<MonthBundle | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const load = useCallback((y: number, m: number, signal: AbortSignal): Promise<MonthBundle> => {
    const key = monthKey(y, m)
    const existing = inFlight.current.get(key)
    if (existing) return existing

    const request: Promise<MonthBundle> = fetchMonth(y, m, signal)
      .then((bundle) => {
        cache.current.set(key, bundle)
        return bundle
      })
      .finally(() => {
        // Identity check: an aborted request is evicted by the effect's cleanup, and a newer
        // request for the same month may already have taken its place by the time this runs.
        if (inFlight.current.get(key) === request) inFlight.current.delete(key)
      })
    inFlight.current.set(key, request)
    return request
  }, [])

  /** Warms up the next month in the background: no `isLoading`, failures swallowed (a prefetch
   * that fails costs nothing — the real load will report it). Scheduled off the critical path. */
  const prefetchNext = useCallback(
    (y: number, m: number) => {
      const nextDate = new Date(y, m, 1) // `m` (1-based) as a 0-based index IS the next month.
      const nextYear = nextDate.getFullYear()
      const nextMonth = nextDate.getMonth() + 1
      if (cache.current.has(monthKey(nextYear, nextMonth))) return

      const run = () => {
        void load(nextYear, nextMonth, new AbortController().signal).catch(() => {})
      }
      if (typeof requestIdleCallback === 'function') requestIdleCallback(run)
      else setTimeout(run, 0)
    },
    [load],
  )

  useEffect(() => {
    const key = monthKey(year, month)
    currentKey.current = key

    const cached = cache.current.get(key)
    if (cached) {
      // Paging back onto a month already in memory repaints instantly — no skeleton flash.
      setData(cached)
      setIsLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    // Captured for the cleanup below: reading `inFlight.current` there directly would read
    // whatever the ref points at when the cleanup runs, not what this effect started with.
    const pendingRequests = inFlight.current
    setData(null)
    setIsLoading(true)
    setError(null)

    load(year, month, controller.signal)
      .then((bundle) => {
        if (controller.signal.aborted || currentKey.current !== key) return
        setData(bundle)
        setIsLoading(false)
        prefetchNext(year, month)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || currentKey.current !== key) return
        setError(err)
        setIsLoading(false)
      })

    return () => {
      controller.abort()
      // The shared in-flight entry belongs to a request that will now reject; drop it so paging
      // straight back onto this month starts a fresh one instead of awaiting the aborted promise.
      pendingRequests.delete(key)
    }
  }, [year, month, reloadToken, load, prefetchNext])

  const invalidateAll = useCallback(() => {
    cache.current.clear()
    inFlight.current.clear()
    setReloadToken((token) => token + 1)
  }, [])

  const retry = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  return { data, isLoading, error, invalidateAll, retry }
}
