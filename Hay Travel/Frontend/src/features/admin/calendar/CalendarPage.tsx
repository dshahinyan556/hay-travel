import { useMemo, useState } from 'react'
import { redirect, useLoaderData, useRevalidator } from 'react-router'
import { Button, Tabs, type TabItem } from '@/shared/ui'
import { canManageCalendar, ensureAuthReady, getAuthState } from '@/shared/auth'
import { getAllTours } from '@/features/admin/api/adminTours'
import {
  createClosureRules,
  deleteClosureRule,
  deleteClosureRules,
  getClosureRules,
} from '@/features/admin/api/adminAvailability'
import type { ClosureRuleCreateModel } from '@/shared/types/booking'
import { CalendarToolbar } from './components/CalendarToolbar'
import { CalendarMonthGrid } from './components/CalendarMonthGrid'
import { DayDetailPanel } from './components/DayDetailPanel'
import { BulkClosurePanel } from './components/BulkClosurePanel'
import { ClosureRulesTable } from './components/ClosureRulesTable'
import { useCalendarMonth } from './hooks/useCalendarMonth'
import { buildCalendarGrid, tourTitleResolver } from './lib/calendarModel'
import { calendarCopy, calendarErrorMessage } from './lib/calendarCopy'
import { isEmptyPlan, planDayToggle } from './lib/closureToggle'

/**
 * Loads only what does NOT depend on the displayed month: the tour list (for names and the bulk
 * scope picker) and every closure rule (for the «Блокировки» tab and for planning day toggles). The
 * month itself is loaded by `useCalendarMonth` — see ADR 016 for why paging months is not
 * navigation and therefore not a loader's job.
 *
 * Checks the permission itself and redirects rather than letting the requests 403: `adminRootLoader`
 * only gates the panel as a whole, so a TourManager typing `/admin/calendar` would otherwise land
 * on a raw error screen. Errors from the two requests are NOT swallowed — they propagate to
 * `AdminErrorBoundary`, same contract as `catalogLoader`.
 */
export async function calendarLoader() {
  await ensureAuthReady()
  if (!canManageCalendar(getAuthState().user?.role)) throw redirect('/admin')

  const [tours, rules] = await Promise.all([getAllTours(), getClosureRules()])
  return { tours, rules }
}

type CalendarTabId = 'calendar' | 'rules'

const tabs: TabItem[] = [
  { id: 'calendar', label: calendarCopy.tabCalendar },
  { id: 'rules', label: calendarCopy.tabRules },
]

/** How far the arrows may travel from the current month, in either direction. A year each way
 * covers real planning; beyond that the admin is looking at data nobody has entered yet. */
const MONTH_RANGE_BACK = 12
const MONTH_RANGE_FORWARD = 12

/** Months since epoch — a single comparable number, so range checks do not have to do
 * year/month arithmetic in two places. */
function monthIndex(year: number, month: number): number {
  return year * 12 + (month - 1)
}

/**
 * Занятость по дням + правила закрытия дат.
 *
 * All state and ALL network mutations live here (the pattern `UsersPage.handleChangeRole` sets);
 * every component below is presentational and reports intent through callbacks.
 *
 * Mutations follow one shape: run → invalidate the month cache AND revalidate the loader (rules
 * changed) → clear pending. On failure the cache is invalidated all the same, because a bulk
 * operation can fail halfway and the screen must not keep showing the state it assumed.
 */
export function CalendarPage() {
  const { tours, rules } = useLoaderData<typeof calendarLoader>()
  const revalidator = useRevalidator()

  const now = useMemo(() => new Date(), [])
  const [view, setView] = useState(() => ({ year: now.getFullYear(), month: now.getMonth() + 1 }))
  const [selectedISO, setSelectedISO] = useState<string | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [tab, setTab] = useState<CalendarTabId>('calendar')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading, error: loadError, invalidateAll, retry } = useCalendarMonth(
    view.year,
    view.month,
  )

  const tourTitle = useMemo(() => tourTitleResolver(tours), [tours])
  const days = useMemo(
    () => buildCalendarGrid(view.year, view.month, data?.calendar ?? null, now),
    [view.year, view.month, data, now],
  )

  const currentIndex = monthIndex(view.year, view.month)
  const todayIndex = monthIndex(now.getFullYear(), now.getMonth() + 1)
  const canGoBack = currentIndex > todayIndex - MONTH_RANGE_BACK
  const canGoForward = currentIndex < todayIndex + MONTH_RANGE_FORWARD

  const selectedDay = selectedISO === null
    ? null
    : (data?.calendar.days.find((day) => day.date === selectedISO) ?? null)
  const selectedIsPast = selectedISO !== null
    && days.find((gridDay) => gridDay.iso === selectedISO)?.isPast === true
  const selectedOrders = useMemo(
    () =>
      selectedISO === null
        ? []
        : (data?.orders.filter((order) => order.tourDate === selectedISO) ?? []),
    [data, selectedISO],
  )

  function shiftMonth(delta: number) {
    setView((prev) => {
      const next = new Date(prev.year, prev.month - 1 + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() + 1 }
    })
  }

  /** Re-reads everything a rule change can affect: the month grid (server-resolved closure state)
   * and the loader's rule list. */
  async function refreshAfterMutation() {
    invalidateAll()
    await revalidator.revalidate()
  }

  async function applyDayToggle(
    dateISO: string,
    tourIds: (number | null)[],
    close: boolean,
    reason: string | null,
  ) {
    if (pending) return
    // Мультивыбор (B12, 2026-08-13): каждый tourId планируется отдельно (собственный
    // deleteIds/create), планы сливаются в один batch — иначе N параллельных applyDayToggle
    // гонялись бы за одним и тем же pending-флагом.
    const plans = tourIds.map((tourId) => planDayToggle(rules, dateISO, tourId, close, reason))
    const plan = {
      deleteIds: plans.flatMap((p) => p.deleteIds),
      create: plans.flatMap((p) => p.create),
    }
    // Nothing to send: the day is already in the requested state and no stale override exists.
    if (isEmptyPlan(plan)) return

    setPending(true)
    setError(null)
    try {
      // Deletes first, one by one — `DeleteRule` takes a single id — then ONE create for the rest.
      // On a mid-way failure we stop and re-read: part of the plan may already be applied.
      for (const id of plan.deleteIds) {
        await deleteClosureRule(id)
      }
      if (plan.create.length > 0) await createClosureRules(plan.create)
      await refreshAfterMutation()
    } catch (err) {
      setError(calendarErrorMessage(err, close ? 'закрыть день' : 'открыть день'))
      await refreshAfterMutation()
    } finally {
      setPending(false)
    }
  }

  async function applyBulk(models: ClosureRuleCreateModel[]) {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      await createClosureRules(models)
      setBulkOpen(false)
      await refreshAfterMutation()
    } catch (err) {
      setError(calendarErrorMessage(err, 'применить массовую операцию'))
      await refreshAfterMutation()
    } finally {
      setPending(false)
    }
  }

  // Единственный путь удаления с вкладки «Блокировки» (2026-08-14): и группа целиком, и
  // произвольная выборка чекбоксами приходят сюда одним списком id — `DeleteRules` тот же
  // эндпоинт что и раньше `DeleteRule`, только на весь список сразу.
  async function removeRules(ids: number[]) {
    if (pending || ids.length === 0) return
    setPending(true)
    setError(null)
    try {
      await deleteClosureRules(ids)
      await refreshAfterMutation()
    } catch (err) {
      setError(calendarErrorMessage(err, 'удалить блокировки'))
      await refreshAfterMutation()
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-neutral-900">{calendarCopy.title}</h1>
        <p className="text-sm text-neutral-500">{calendarCopy.subtitle}</p>
      </header>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          <span aria-hidden="true">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Pinned below the mobile hamburger bar (60px) on phones, flush to the viewport top on
          desktop where that bar doesn't exist — same treatment as `CatalogPage`. The calendar
          toolbar («Массовые операции») joins this SAME sticky block (2026-08-14, on request) —
          nested inside rather than given its own independent `sticky top-[…]`, so it never needs
          a hand-measured offset for the tabs' height above it; the two just stack in normal flow
          and move as one pinned unit. */}
      <div className="sticky top-[60px] z-10 -mx-4 flex flex-col gap-3 bg-neutral-50 px-4 pt-1 pb-3 sm:-mx-6 sm:px-6 md:top-0">
        <Tabs
          tabs={tabs}
          activeId={tab}
          onChange={(id) => setTab(id as CalendarTabId)}
          label={calendarCopy.tabsLabel}
        />
        {tab === 'calendar' && (
          <CalendarToolbar
            year={view.year}
            month={view.month}
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            isLoading={isLoading}
            onPrev={() => shiftMonth(-1)}
            onNext={() => shiftMonth(1)}
            onOpenBulk={() => setBulkOpen(true)}
          />
        )}
      </div>

      {tab === 'calendar' && (
        <div className="flex flex-col gap-4">
          {loadError != null ? (
            // The toolbar stays usable above this — paging to another month is a valid way out of
            // a failed one.
            <div className="rounded-xl border border-neutral-200 bg-white px-6 py-12 text-center">
              <p className="text-sm text-neutral-600">{calendarCopy.gridLoadFailed}</p>
              <Button type="button" variant="secondary" onClick={retry} className="mt-3 min-h-11">
                {calendarCopy.retry}
              </Button>
            </div>
          ) : (
            <CalendarMonthGrid
              days={days}
              selectedISO={selectedISO}
              tourTitle={tourTitle}
              onSelectDay={setSelectedISO}
              isSkeleton={data === null}
            />
          )}

          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-500">
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 rounded border border-neutral-200 bg-neutral-100 bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,rgb(0_0_0/0.08)_3px,rgb(0_0_0/0.08)_6px)]"
              />
              {calendarCopy.legendClosed}
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {calendarCopy.legendPartial}
            </li>
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700"
              >
                3
              </span>
              {calendarCopy.legendOrders}
            </li>
          </ul>
        </div>
      )}

      {tab === 'rules' && (
        <ClosureRulesTable
          rules={rules}
          tours={tours}
          pending={pending}
          onDeleteSelected={(ids) => void removeRules(ids)}
        />
      )}

      <DayDetailPanel
        open={selectedISO !== null}
        dateISO={selectedISO}
        day={selectedDay}
        orders={selectedOrders}
        tours={tours}
        rules={rules}
        pending={pending}
        isPast={selectedIsPast}
        onClose={() => setSelectedISO(null)}
        onToggleClosure={(tourIds, close, reason) => {
          if (selectedISO === null) return
          void applyDayToggle(selectedISO, tourIds, close, reason)
        }}
      />

      <BulkClosurePanel
        open={bulkOpen}
        tours={tours}
        pending={pending}
        onClose={() => setBulkOpen(false)}
        onApply={(models) => void applyBulk(models)}
      />
    </div>
  )
}
