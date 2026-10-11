import { useMemo, useState } from 'react'
import { redirect, useLoaderData, useRevalidator } from 'react-router'
import {
  AdminToolbar,
  Button,
  DataEntryScreenLayout,
  Tabs,
  UnsavedChangesModal,
  type TabItem,
} from '@/shared/ui'
import { AlertIcon } from '@/shared/ui/icons'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { useUnsavedChangesGuard } from '@/shared/hooks'
import {
  AdminScreen,
  canView,
  ensurePermissionsReady,
  useScreenPermission,
} from '@/shared/auth'
import { getAllTours } from '@/features/admin/api/adminTours'
import { getClosureRules } from '@/features/admin/api/adminAvailability'
import { CalendarToolbar } from './components/CalendarToolbar'
import { CalendarMonthGrid } from './components/CalendarMonthGrid'
import { DayDetailPanel } from './components/DayDetailPanel'
import { BulkClosurePanel } from './components/BulkClosurePanel'
import { ClosureRulesTable } from './components/ClosureRulesTable'
import { useCalendarDraft } from './hooks/useCalendarDraft'
import { useCalendarMonth } from './hooks/useCalendarMonth'
import { buildCalendarGrid, tourTitleResolver } from './lib/calendarModel'
import { calendarCopy, calendarErrorMessage } from './lib/calendarCopy'
import { applyDraftToGrid } from './lib/calendarDraft'
import { remainingDraft, saveCalendarDraft, type DraftSaveStage } from './lib/calendarDraftSave'

/**
 * Loads only what does NOT depend on the displayed month: the tour list (for names and the bulk
 * scope picker) and every closure rule (for the «Блокировки» tab and for planning day toggles). The
 * month itself is loaded by `useCalendarMonth` — see ADR 016 for why paging months is not
 * navigation and therefore not a loader's job.
 *
 * Checks the permission itself and redirects rather than letting the requests 403: `adminRootLoader`
 * only gates the panel as a whole, so somebody without `calendar.View` typing `/admin/calendar`
 * would otherwise land on a raw error screen. Errors from the two requests are NOT swallowed — they
 * propagate to `AdminErrorBoundary`, same contract as `catalogLoader`.
 */
export async function calendarLoader() {
  await ensurePermissionsReady()
  if (!canView(AdminScreen.Calendar)) throw redirect('/admin')

  // `Tour/GetAll` is gated by `products.View`, a DIFFERENT key: a role granted only the calendar
  // would get a 403 on a screen it was explicitly given. The tour list is auxiliary here (names on
  // closure rules, the bulk scope picker), so it degrades to empty — the same trade the dashboard
  // makes. It is not the §0.8 case: nothing here silently saves a broken object without it.
  const [tours, rules] = await Promise.all([
    canView(AdminScreen.Products) ? getAllTours() : Promise.resolve([]),
    getClosureRules(),
  ])
  return { tours, rules }
}

type CalendarTabId = 'calendar' | 'rules'

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
 * Template A — «Экран ввода данных» (`DataEntryScreenLayout`) with a PAGE DRAFT (2026-10-11,
 * aligned with `OrderDetailPage`): `AdminToolbar` in the pinned control zone, nothing reaches the
 * server until «Сохранить». The draft (`useCalendarDraft`, rules in `lib/calendarDraft.ts`) holds
 * day toggles from the day panel, new rules from «Добавить» (bulk closure) and saved rules marked
 * for deletion; the screen state is the server state with the draft laid over it.
 *
 * All state and ALL network mutations live here (the pattern `UsersPage.handleChangeRole` sets);
 * every component below is presentational and reports intent through callbacks. Save runs
 * `saveCalendarDraft` (deletes → day toggles → new rules, one failed group does not undo the
 * others), then invalidates the month cache AND revalidates the loader. On failure the cache is
 * invalidated all the same, because a save can fail halfway and the screen must not keep showing
 * the state it assumed.
 *
 * The month navigation is NOT in the control zone — it belongs to the calendar tab's body; the zone
 * pins what has to stay in reach on a long page: the toolbar and the tabs.
 */
export function CalendarPage() {
  const { tours, rules } = useLoaderData<typeof calendarLoader>()
  const revalidator = useRevalidator()
  const copy = useCopy(calendarCopy)
  // Through the hook, not the bare predicate: the matrix is refetched in the background on every
  // token rotation, and the controls have to follow it without a navigation.
  const permission = useScreenPermission(AdminScreen.Calendar)
  const { locale } = useLocale()

  const now = useMemo(() => new Date(), [])
  const [view, setView] = useState(() => ({ year: now.getFullYear(), month: now.getMonth() + 1 }))
  const [selectedISO, setSelectedISO] = useState<string | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [tab, setTab] = useState<CalendarTabId>('calendar')
  const [pending, setPending] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  /** Rules ticked in the «Блокировки» table — lives here because «Удалить» is in the toolbar. */
  const [selectedRules, setSelectedRules] = useState<Set<number>>(new Set())

  const draft = useCalendarDraft(rules)
  const guard = useUnsavedChangesGuard(draft.isDirty && !pending)

  const { data, isLoading, error: loadError, invalidateAll, retry } = useCalendarMonth(
    view.year,
    view.month,
  )

  const tabs: TabItem[] = [
    { id: 'calendar', label: copy.tabCalendar, unsavedDot: draft.hasToggles ? copy.tabUnsaved : undefined },
    { id: 'rules', label: copy.tabRules, unsavedDot: draft.hasRuleChanges ? copy.tabUnsaved : undefined },
  ]

  const tourTitle = useMemo(() => tourTitleResolver(tours, locale, copy), [tours, locale, copy])
  /** `TourType` продукта по id — нужен планировщику закрытий (`planDayToggle`), чтобы правила
   * области «весь тип» участвовали в базовом состоянии продукта, как на сервере. */
  const tourTypeById = useMemo(
    () => new Map(tours.map((tour) => [tour.id, tour.type as number])),
    [tours],
  )
  const baseDays = useMemo(
    () => buildCalendarGrid(view.year, view.month, data?.calendar ?? null, now),
    [view.year, view.month, data, now],
  )
  const days = useMemo(
    () => applyDraftToGrid(baseDays, draft.toggles, draft.touchingRules),
    [baseDays, draft.toggles, draft.touchingRules],
  )

  /** Saved rules + the draft's new ones: the table draws both. */
  const tableRules = useMemo(() => [...rules, ...draft.draftRules], [rules, draft.draftRules])
  /** Selection narrowed to rows that still exist and are not already marked for deletion. */
  const liveSelected = useMemo(() => {
    const live = new Set(tableRules.filter((rule) => !draft.deletedIds.has(rule.id)).map((rule) => rule.id))
    return new Set([...selectedRules].filter((id) => live.has(id)))
  }, [selectedRules, tableRules, draft.deletedIds])

  const currentIndex = monthIndex(view.year, view.month)
  const todayIndex = monthIndex(now.getFullYear(), now.getMonth() + 1)
  const canGoBack = currentIndex > todayIndex - MONTH_RANGE_BACK
  const canGoForward = currentIndex < todayIndex + MONTH_RANGE_FORWARD

  // The panel gets the SAVED day: it lays the draft over it itself and needs the saved state to
  // tell a real change from a click that puts things back.
  const selectedDay = selectedISO === null
    ? null
    : (data?.calendar.days.find((day) => day.date === selectedISO) ?? null)
  const selectedIsPast = selectedISO !== null
    && baseDays.find((gridDay) => gridDay.iso === selectedISO)?.isPast === true
  const selectedOrders = useMemo(
    () =>
      selectedISO === null
        ? []
        : (data?.orders.filter((line) => line.tourDate === selectedISO) ?? []),
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

  const actionOf: Record<DraftSaveStage, string> = {
    delete: copy.errorActions.deleteRules,
    close: copy.errorActions.closeDay,
    open: copy.errorActions.openDay,
    bulk: copy.errorActions.applyBulk,
  }

  async function handleSave() {
    if (pending || !draft.isDirty) return
    setPending(true)
    setErrors([])
    try {
      const outcome = await saveCalendarDraft({ draft: draft.state, rules, tourTypeById })
      // What did not reach the server stays in the draft; everything else is gone from it.
      draft.replace(remainingDraft(draft.state, outcome))
      setSelectedRules(new Set())
      if (outcome.failures.length > 0) {
        const messages = outcome.failures.map((failure) =>
          calendarErrorMessage(copy, failure.error, actionOf[failure.stage]),
        )
        if (outcome.appliedGroups > 0) messages.push(copy.partialSaved)
        setErrors([...new Set(messages)])
      }
      await refreshAfterMutation()
    } finally {
      setPending(false)
    }
  }

  function handleCancel() {
    draft.reset()
    setSelectedRules(new Set())
    setErrors([])
  }

  /** «Удалить» тулбара: сохранённые правила помечаются «удалится», новые из черновика просто
   * убираются. Ничего не уходит на сервер до «Сохранить». */
  function handleDelete() {
    const ids = [...liveSelected]
    draft.discardNewRules(ids.filter((id) => id < 0).map((id) => -id))
    draft.markDeleted(ids.filter((id) => id > 0), true)
    setSelectedRules(new Set())
  }

  // «Save» needs the rights of everything the draft contains: a toggle may create a rule (close) or
  // delete one (open), so it counts for both — the same pairing the day panel is gated by.
  const needsCreate = draft.state.newRules.length > 0 || draft.hasToggles
  const needsDelete = draft.deletedIds.size > 0 || draft.hasToggles
  const saveHint =
    (needsCreate && !permission.canCreate) || (needsDelete && !permission.canDelete)
      ? copy.noPermissionHint
      : null

  return (
    <>
      <DataEntryScreenLayout
        title={copy.title}
        subtitle={copy.subtitle}
        controlZone={
          <>
            <div className="flex w-full flex-wrap items-center gap-3">
              <AdminToolbar
                className="w-full sm:w-auto"
                onCancel={handleCancel}
                onSave={() => void handleSave()}
                onAdd={() => setBulkOpen(true)}
                onDelete={handleDelete}
                // Cancel only drops the local draft — no rights involved, no hint.
                cancelState={{ disabled: pending || !draft.isDirty }}
                saveState={{
                  disabled: pending || !draft.isDirty || saveHint !== null,
                  pending,
                  hint: saveHint,
                }}
                // «Добавить» opens the bulk-closure panel, which creates rules.
                addState={{
                  disabled: pending || !permission.canCreate,
                  hint: permission.canCreate ? null : copy.noPermissionHint,
                }}
                // Works on the «Блокировки» tab with rows ticked; on the calendar tab there is
                // nothing selectable, so it stays off.
                deleteState={{
                  disabled: pending || !permission.canDelete || tab !== 'rules' || liveSelected.size === 0,
                  hint: permission.canDelete ? null : copy.noPermissionHint,
                }}
              />
              {draft.isDirty && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
                  {copy.changeCount(draft.changeCount)}
                </span>
              )}
            </div>
            <div className="w-full">
              <Tabs
                tabs={tabs}
                activeId={tab}
                onChange={(id) => setTab(id as CalendarTabId)}
                label={copy.tabsLabel}
              />
            </div>
          </>
        }
        message={
          errors.length > 0 && (
            <>
              {errors.map((message) => (
                <div
                  key={message}
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                >
                  <AlertIcon size={16} className="mt-0.5 shrink-0" />
                  <span>{message}</span>
                </div>
              ))}
            </>
          )
        }
      >
        {tab === 'calendar' && (
          <div className="flex flex-col gap-4">
            <CalendarToolbar
              year={view.year}
              month={view.month}
              canGoBack={canGoBack}
              canGoForward={canGoForward}
              isLoading={isLoading}
              onPrev={() => shiftMonth(-1)}
              onNext={() => shiftMonth(1)}
            />

            {loadError != null ? (
              // The month navigation stays usable above this — paging to another month is a valid
              // way out of a failed one.
              <div className="rounded-xl border border-neutral-200 bg-white px-6 py-12 text-center">
                <p className="text-sm text-neutral-600">{copy.gridLoadFailed}</p>
                <Button type="button" variant="secondary" onClick={retry} className="mt-3 min-h-11">
                  {copy.retry}
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
                {copy.legendClosed}
              </li>
              <li className="flex items-center gap-1.5">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-neutral-900" />
                {copy.legendPartial}
              </li>
              {/* Закрытие целого типа продукта (решение 0.27) — тот же угол клетки, но кольцо, а не
                  заливка: «закрыты трансферы» и «закрыт вот этот тур» не должны выглядеть одинаково,
                  а места на слово в 55px-клетке нет. Что именно закрыто, клетка проговаривает в
                  aria-label/title. */}
              <li className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full border-[1.5px] border-neutral-900 bg-white"
                />
                {copy.legendPartialTypes}
              </li>
              <li className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700"
                >
                  3
                </span>
                {copy.legendOrders}
              </li>
              {/* Черновик: синяя штриховка — день станет закрытым, синий пунктир — станет открытым
                  или затронут блокировкой из черновика. */}
              <li className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="h-3.5 w-3.5 rounded border border-dashed border-blue-600 bg-blue-50 bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,rgb(29_78_216/0.2)_3px,rgb(29_78_216/0.2)_6px)]"
                />
                {copy.legendDraftClose}
              </li>
              <li className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="h-3.5 w-3.5 rounded border border-dashed border-blue-600 bg-white"
                />
                {copy.legendDraftOpen}
              </li>
            </ul>
          </div>
        )}

        {tab === 'rules' && (
          <ClosureRulesTable
            rules={tableRules}
            tours={tours}
            pending={pending}
            deletedIds={draft.deletedIds}
            selected={liveSelected}
            onSelectedChange={setSelectedRules}
            onRestore={(ids) => draft.markDeleted(ids, false)}
            onDiscardNew={(ids) => draft.discardNewRules(ids.map((id) => -id))}
            canDelete={permission.canDelete}
          />
        )}
      </DataEntryScreenLayout>

      <DayDetailPanel
        open={selectedISO !== null}
        dateISO={selectedISO}
        day={selectedDay}
        orders={selectedOrders}
        tours={tours}
        rules={rules}
        draftMarks={selectedISO === null ? null : draft.marksOf(selectedISO)}
        reason={selectedISO === null ? '' : draft.reasonOf(selectedISO)}
        pending={pending}
        isPast={selectedIsPast}
        // Closing a day CREATES a rule and re-opening it DELETES one — both are needed for the
        // toggle to be meaningful, so a role with only one of them gets a read-only block.
        canManage={permission.canCreate && permission.canDelete}
        readOnlyHint={copy.closureReadOnlyHint}
        onClose={() => setSelectedISO(null)}
        onToggleClosure={(scope, close, savedClosed) => {
          if (selectedISO === null) return
          draft.setToggle(selectedISO, scope, close, savedClosed)
        }}
        onReasonChange={(reason) => {
          if (selectedISO === null) return
          draft.setReason(selectedISO, reason)
        }}
      />

      <BulkClosurePanel
        open={bulkOpen}
        tours={tours}
        pending={pending}
        onClose={() => setBulkOpen(false)}
        onAdd={(models) => {
          draft.addBulk(models)
          setBulkOpen(false)
        }}
      />

      <UnsavedChangesModal open={guard.isBlocking} onCancel={guard.cancel} onConfirm={guard.confirm} />
    </>
  )
}
