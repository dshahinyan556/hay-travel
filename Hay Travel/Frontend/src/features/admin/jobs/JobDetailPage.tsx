import { useEffect, useState } from 'react'
import { Link, redirect, useLoaderData, useRevalidator } from 'react-router'
import type { LoaderFunctionArgs } from 'react-router'
import {
  AdminActionButton,
  AdminSummaryPanel,
  AdminToolbar,
  DataEntryScreenLayout,
  Tabs,
  Tooltip,
  UnsavedChangesModal,
  type AdminSummaryRow,
  type TabItem,
} from '@/shared/ui'
import { HelpButton } from '@/shared/ui/HelpButton'
import { HelpRevealZone } from '@/shared/ui/HelpReveal'
import { AlertIcon, CheckIcon, PlayIcon } from '@/shared/ui/icons'
import { useUnsavedChangesGuard } from '@/shared/hooks'
import { AdminScreen, canView, ensurePermissionsReady, useScreenPermission } from '@/shared/auth'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { getStoredLocale, type Locale } from '@/shared/lib/locale'
import {
  getAutoCloseOverrides,
  getJobRuns,
  getJobs,
  runJob,
  setAutoCloseOverrides,
  setJobCron,
  setJobEnabled,
  setJobParameters,
} from '@/features/admin/api/adminJobs'
import { getAllTours } from '@/features/admin/api/adminTours'
import { SettingValueType } from '@/features/admin/lib/enums'
import type { ScheduledJobInfoModel, ScheduledJobRunInfoModel, TourAutoCloseOverrideInfoModel } from '@/features/admin/types/jobs'
import type { TourInfoModel } from '@/shared/types/attours'
import { jobsCopy, jobsErrorMessage, type JobsCopy } from './lib/jobsCopy'
import { jobPermissionHints } from './lib/jobsPermissionHints'
import {
  AUTO_CLOSURE_JOB_KEY,
  capitalizeFirst,
  cronToPreset,
  isPlausibleCronExpression,
  isValidLeadTimeHours,
  isValidParameterNumber,
  canonicalCron,
  overrideRowsEqual,
  parameterValuesEqual,
  scheduleFrequencyLabel,
  type TourAutoCloseOverrideDraftRow,
} from './lib/jobsModel'
import { formatDurationSeconds, formatYerevanDateTime, formatYerevanUpcoming, minutesUntil } from './lib/jobsTime'
import { JobScheduleCard } from './components/JobScheduleCard'
import { JobParametersCard } from './components/JobParametersCard'
import { AutoCloseOverridesCard } from './components/AutoCloseOverridesCard'
import { JobRunsList } from './components/JobRunsList'
import { JobStatusBadge } from './components/JobStatusBadge'

/** No single-job GET exists on the backend (`JobsController.cs` only has `GetAll`/mutation
 * endpoints, each of which re-reads and returns its OWN job) — so the detail route fetches the
 * whole list, same as `JobsPage`, and picks its one row out of it. Paired with `getJobRuns` for
 * the "История" tab, same "two independent GETs, in parallel" shape as `orderDetailLoader`.
 *
 * `overrides`/`tours` are fetched ONLY for `tour-date-auto-closure` (checklist
 * `checklist-autoclose-per-tour-2026-08-29.txt`, Р3): every other job's card has no use for a
 * full product list, so no other job page pays for it. Both come back empty for any other job,
 * never `undefined` — the view's own `job.key` check decides whether to render the card at all,
 * the loader's shape stays uniform either way. */
export async function jobDetailLoader({ params }: LoaderFunctionArgs) {
  await ensurePermissionsReady()
  if (!canView(AdminScreen.Jobs)) throw redirect('/admin')

  const key = params.key ?? ''
  const isAutoClosureJob = key === AUTO_CLOSURE_JOB_KEY
  const [jobs, runs, overrides, tours] = await Promise.all([
    getJobs(),
    getJobRuns(key),
    isAutoClosureJob ? getAutoCloseOverrides() : Promise.resolve<TourAutoCloseOverrideInfoModel[]>([]),
    isAutoClosureJob ? getAllTours() : Promise.resolve<TourInfoModel[]>([]),
  ])
  const job = jobs.find((candidate) => candidate.key === key)
  if (!job) {
    // Same loader-time-locale rule as `orderDetailLoader`'s `invalidOrderId` (defineCopy.ts §3):
    // no `useCopy` exists yet, the module is called directly against the persisted locale.
    throw new Response(jobsCopy(getStoredLocale()).errors.notFound, { status: 404 })
  }
  return { job, runs, overrides, tours }
}

export function JobDetailPage() {
  const { job, runs, overrides, tours } = useLoaderData<typeof jobDetailLoader>()
  // Keyed by job key: navigating between two job URLs remounts with a fresh draft/tab instead of
  // carrying the previous job's edits over — same reasoning as `OrderDetailPage`/`UserDetailPage`.
  return <JobDetailView key={job.key} job={job} runs={runs} overrides={overrides} tours={tours} />
}

type JobDetailTabId = 'overview' | 'history'

/** One draft for the whole page (mockup §01/§06: "Один экран — одна кнопка сохранения"). `cron`
 * carries the RAW `PATCH .../Cron` payload semantics — `''` means "reset to the catalog default"
 * — so `JobDetailView` is the one place that translates between that wire shape and the plain
 * "effective cron string" `JobScheduleCard` renders/edits. `parameters` holds only touched keys,
 * same "absent = unchanged" convention `OrderDetailPage`'s `LineDraftPatch` uses.
 *
 * `overrides` — «Исключения по продуктам», `tour-date-auto-closure` only (checklist
 * `checklist-autoclose-per-tour-2026-08-29.txt`, Р3/F2). `undefined` = untouched since load, same
 * "absent = unchanged" rule as `parameters`; once touched it carries the FULL desired set (not a
 * patch) — `PUT api/Jobs/AutoCloseOverrides` replaces the whole set (B8), there is no per-row
 * mutation to send. */
interface JobDraft {
  enabled?: boolean
  cron?: string
  parameters: Record<string, string>
  overrides?: TourAutoCloseOverrideDraftRow[]
}

const EMPTY_DRAFT: JobDraft = { parameters: {} }

function effectiveCronOf(draftCron: string | undefined, job: ScheduledJobInfoModel): string {
  if (draftCron === undefined) return job.cronExpression
  return draftCron === '' ? job.defaultCronExpression : draftCron
}

interface JobDetailViewProps {
  job: ScheduledJobInfoModel
  runs: ScheduledJobRunInfoModel[]
  overrides: TourAutoCloseOverrideInfoModel[]
  tours: TourInfoModel[]
}

function JobDetailView({ job, runs, overrides, tours }: JobDetailViewProps) {
  const copy = useCopy(jobsCopy)
  const { locale } = useLocale()
  const revalidator = useRevalidator()
  const permission = useScreenPermission(AdminScreen.Jobs)
  const hints = jobPermissionHints(permission, copy.readOnlyHint)

  const [tab, setTab] = useState<JobDetailTabId>('overview')
  const [draft, setDraft] = useState<JobDraft>(EMPTY_DRAFT)
  const [pending, setPending] = useState(false)
  const [runPending, setRunPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Poll while a run is in flight (checklist §11: "раз в 3 секунды, пока isRunning = true", no
  // background polling otherwise) — covers both a run started from THIS page and one that was
  // already in flight when the page was opened (e.g. the admin refreshed mid-run).
  useEffect(() => {
    if (!job.isRunning) return
    const id = setInterval(() => void revalidator.revalidate(), 3000)
    return () => clearInterval(id)
  }, [job.isRunning, revalidator])

  // Dirty — по отличию от сохранённого, а не по факту «поле трогали» (баг 2026-10-11): повторный
  // выбор того же пункта в `Select` частоты переписывает cron заново (`presetToCron`), поэтому
  // расписание сравнивается в канонической форме, числовые параметры — по числу.
  const enabledDirty = draft.enabled !== undefined && draft.enabled !== job.isEnabled
  const cronDirty =
    draft.cron !== undefined && canonicalCron(effectiveCronOf(draft.cron, job)) !== canonicalCron(job.cronExpression)
  const dirtyParamKeys = Object.keys(draft.parameters).filter((key) => {
    const definition = job.parameters.find((p) => p.key === key)
    if (!definition) return false
    return !parameterValuesEqual(draft.parameters[key], definition.value, definition.valueType === SettingValueType.Number)
  })

  // «Исключения по продуктам» — `tour-date-auto-closure` only. Baseline is the loader's own
  // list turned into draft-row shape (`leadTimeHours` as an editable string, `AddButton`'s Input
  // convention), rebuilt every render from `overrides` (empty for every other job, cheap either way
  // — no `useMemo` warranted for a handful of rows).
  const isAutoClosureJob = job.key === AUTO_CLOSURE_JOB_KEY
  const baselineOverrides: TourAutoCloseOverrideDraftRow[] = overrides.map((o) => ({
    tourId: o.tourId,
    tourName: o.tourName,
    leadTimeHours: String(o.leadTimeHours),
  }))
  const effectiveOverrides = draft.overrides ?? baselineOverrides
  const overridesDirty = draft.overrides !== undefined && !overrideRowsEqual(draft.overrides, baselineOverrides)

  const dirty = enabledDirty || cronDirty || dirtyParamKeys.length > 0 || overridesDirty

  const cronValid = draft.cron === undefined || isPlausibleCronExpression(draft.cron)
  const parametersValid = dirtyParamKeys.every((key) => {
    const definition = job.parameters.find((p) => p.key === key)
    if (definition?.valueType !== SettingValueType.Number) return true
    return isValidParameterNumber(draft.parameters[key])
  })
  const overridesValid = draft.overrides === undefined || draft.overrides.every((row) => isValidLeadTimeHours(row.leadTimeHours))

  const guard = useUnsavedChangesGuard(dirty && !pending)

  const effectiveEnabled = draft.enabled ?? job.isEnabled
  const effectiveCron = effectiveCronOf(draft.cron, job)

  async function handleSave() {
    if (pending || !dirty || !cronValid || !parametersValid || !overridesValid || hints.update !== null) return
    setPending(true)
    setError(null)
    setNotice(null)
    try {
      const calls: Promise<unknown>[] = []
      if (enabledDirty) calls.push(setJobEnabled(job.key, { isEnabled: draft.enabled! }))
      if (cronDirty) calls.push(setJobCron(job.key, { cronExpression: draft.cron! }))
      if (dirtyParamKeys.length > 0) {
        const values: Record<string, string> = {}
        for (const key of dirtyParamKeys) values[key] = draft.parameters[key]
        calls.push(setJobParameters(job.key, { values }))
      }
      if (overridesDirty) {
        calls.push(
          setAutoCloseOverrides({
            overrides: draft.overrides!.map((row) => ({ tourId: row.tourId, leadTimeHours: Number(row.leadTimeHours) })),
          }),
        )
      }
      await Promise.all(calls)
      setDraft(EMPTY_DRAFT)
      setNotice(copy.savedBanner)
      await revalidator.revalidate()
    } catch (err) {
      setError(jobsErrorMessage(copy, err, copy.errorActions.save))
    } finally {
      setPending(false)
    }
  }

  function handleCancel() {
    setDraft(EMPTY_DRAFT)
  }

  // Сеттеры черновика: значение, вернувшееся к сохранённому, из черновика выкидывается.
  function handleChangeEnabled(next: boolean) {
    setDraft((prev) => ({ ...prev, enabled: next === job.isEnabled ? undefined : next }))
  }

  function handleChangeCron(next: string) {
    const unchanged = canonicalCron(next) === canonicalCron(job.cronExpression)
    setDraft((prev) => ({
      ...prev,
      cron: unchanged ? undefined : next === job.defaultCronExpression ? '' : next,
    }))
  }

  function handleChangeParameter(key: string, value: string) {
    const saved = job.parameters.find((p) => p.key === key)?.value
    setDraft((prev) => {
      const parameters = { ...prev.parameters }
      if (value === saved) delete parameters[key]
      else parameters[key] = value
      return { ...prev, parameters }
    })
  }

  function updateOverrides(change: (rows: TourAutoCloseOverrideDraftRow[]) => TourAutoCloseOverrideDraftRow[]) {
    setDraft((prev) => {
      const next = change(prev.overrides ?? baselineOverrides)
      // Выкидываем только побуквенно совпавший набор: «024» вместо «24» не грязный (см.
      // `overridesDirty`), но и в инпуте не должен откатываться посреди ввода.
      const identical =
        overrideRowsEqual(next, baselineOverrides) &&
        next.every((row) => baselineOverrides.find((b) => b.tourId === row.tourId)?.leadTimeHours === row.leadTimeHours)
      return { ...prev, overrides: identical ? undefined : next }
    })
  }

  async function handleRunNow() {
    if (runPending || job.isRunning || hints.update !== null) return
    setRunPending(true)
    setError(null)
    setNotice(null)
    try {
      const result = await runJob(job.key)
      setNotice(result.accepted ? copy.runStartedBanner : copy.runAlreadyRunningBanner)
      await revalidator.revalidate()
    } catch (err) {
      setError(jobsErrorMessage(copy, err, copy.errorActions.run))
    } finally {
      setRunPending(false)
    }
  }

  const tabs: TabItem[] = [
    { id: 'overview', label: copy.tabOverview },
    { id: 'history', label: copy.tabHistory, badge: runs.length },
  ]

  const summaryRows: AdminSummaryRow[] = [
    { key: 'state', label: copy.summaryState, value: effectiveEnabled ? copy.stateEnabled : copy.stateDisabled },
    {
      key: 'schedule',
      label: copy.summarySchedule,
      value: (
        <>
          {capitalizeFirst(scheduleFrequencyLabel(cronToPreset(effectiveCron), copy))}
          {cronDirty && <UnsavedBadge label={copy.unsavedBadge} />}
          <span className="mt-0.5 block font-mono text-xs font-normal text-neutral-400">{effectiveCron}</span>
        </>
      ),
    },
    {
      key: 'nextRun',
      label: copy.summaryNextRun,
      value: job.nextRunAtUtc ? (
        <>
          {formatYerevanUpcoming(new Date(job.nextRunAtUtc), locale, copy.today, copy.tomorrow)}
          <span className="mt-0.5 block text-xs font-normal text-neutral-400">
            {cronDirty ? copy.summaryBySavedSchedule : copy.inMinutes(minutesUntil(job.nextRunAtUtc))}
          </span>
        </>
      ) : (
        copy.notScheduled
      ),
    },
    {
      key: 'lastRun',
      label: copy.summaryLastRun,
      value: job.lastRun ? (
        <>
          {formatYerevanDateTime(job.lastRun.startedAtUtc, locale)}
          <span className="mt-0.5 block text-xs font-normal text-neutral-400">
            {copy.summaryAffectedAndDuration(
              job.lastRun.affectedCount,
              formatDurationSeconds(job.lastRun.startedAtUtc, job.lastRun.finishedAtUtc, locale),
            )}
          </span>
        </>
      ) : (
        copy.neverRun
      ),
    },
    ...job.parameters.map((parameter) => {
      const known = copy.parameters[parameter.key]
      const isDirtyParam = dirtyParamKeys.includes(parameter.key)
      const value = draft.parameters[parameter.key] ?? parameter.value
      return {
        key: parameter.key,
        label: known?.summaryLabel ?? parameter.key,
        value: (
          <>
            {value} {known?.unitShort ?? ''}
            {isDirtyParam && <UnsavedBadge label={copy.unsavedBadge} />}
          </>
        ),
      }
    }),
  ]

  const helpText = copy.jobHelpTextByKey[job.key]

  return (
    <DataEntryScreenLayout
      breadcrumbs={
        <>
          <Link to="/admin/jobs" className="transition-colors hover:text-neutral-800">
            {copy.backToList}
          </Link>
          <span aria-hidden="true"> · </span>
          <span className="font-semibold text-neutral-800">{job.displayName}</span>
        </>
      }
      breadcrumbsLabel={copy.breadcrumbsLabel}
      title={
        <HelpRevealZone as="span" enabled={Boolean(helpText)} className="flex flex-wrap items-center gap-2">
          {job.displayName}
          {helpText && (
            <HelpButton surface="admin" title={job.displayName}>
              {helpText}
            </HelpButton>
          )}
          {job.lastRun && <JobStatusBadge status={job.lastRun.status} />}
        </HelpRevealZone>
      }
      subtitle={
        <>
          {copy.keyLabel}: <span className="font-mono text-xs text-neutral-700">{job.key}</span>
          {' · '}
          {copy.nextRunPrefix}:{' '}
          {job.nextRunAtUtc ? (
            <>
              <b className="font-semibold text-neutral-800">
                {formatYerevanUpcoming(new Date(job.nextRunAtUtc), locale, copy.today, copy.tomorrow)}
              </b>{' '}
              ({copy.inMinutes(minutesUntil(job.nextRunAtUtc))})
            </>
          ) : (
            copy.notScheduled
          )}
        </>
      }
      controlZone={
        <>
          <AdminToolbar
            onCancel={handleCancel}
            onSave={() => void handleSave()}
            cancelState={{ disabled: pending || !dirty }}
            saveState={{
              disabled: pending || !dirty || !cronValid || !parametersValid || !overridesValid || hints.update !== null,
              pending,
              hint: hints.update,
            }}
          />
          <HelpRevealZone enabled={dirty} className="flex items-center gap-2">
            <Tooltip enabled={Boolean(hints.update)} content={hints.update} cursor="not-allowed">
              <AdminActionButton
                label={copy.runNowButton}
                pendingLabel={copy.runNowButtonPending}
                icon={<PlayIcon size={17} />}
                variant="secondary"
                onClick={() => void handleRunNow()}
                disabled={job.isRunning || hints.update !== null}
                pending={runPending}
              />
            </Tooltip>
            {dirty && (
              <HelpButton surface="admin" title={copy.runNowButton}>
                {copy.runNowHintWhenDirty}
              </HelpButton>
            )}
          </HelpRevealZone>
        </>
      }
      message={
        (hints.update || error || notice) && (
          <>
            {hints.update && (
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                {hints.update}
              </div>
            )}
            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertIcon size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {notice && (
              <div role="status" className="flex items-start gap-2 rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-900">
                <CheckIcon size={16} className="mt-0.5 shrink-0" />
                <span>{notice}</span>
              </div>
            )}
          </>
        )
      }
    >
      {/* Сводка — боковой колонкой справа на десктопе и первой на мобиле (`order`): шапку записи
          (название, ключ, следующий запуск, статус) теперь несёт заголовок шаблона. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <AdminSummaryPanel title={copy.summaryTitle} className="lg:order-2 lg:self-start" rows={summaryRows} />

        <div className="flex min-w-0 flex-col gap-4 lg:order-1">
          <Tabs tabs={tabs} activeId={tab} onChange={(id) => setTab(id as JobDetailTabId)} label={copy.tabsLabel} />

          {tab === 'overview' && (
            <div className="flex flex-col gap-4">
              <JobScheduleCard
                isEnabled={effectiveEnabled}
                onChangeEnabled={handleChangeEnabled}
                cron={effectiveCron}
                onChangeCron={handleChangeCron}
                scheduleDirty={cronDirty}
                disabled={pending || hints.update !== null}
              />
              <JobParametersCard
                parameters={job.parameters}
                draftValues={draft.parameters}
                onChange={handleChangeParameter}
                disabled={pending || hints.update !== null}
              />
              {isAutoClosureJob && (
                <AutoCloseOverridesCard
                  rows={effectiveOverrides}
                  tours={tours}
                  disabled={pending || hints.update !== null}
                  onAddRow={(tourId, tourName, leadTimeHours) =>
                    updateOverrides((rows) => [...rows, { tourId, tourName, leadTimeHours }])
                  }
                  onChangeHours={(tourId, value) =>
                    updateOverrides((rows) =>
                      rows.map((row) => (row.tourId === tourId ? { ...row, leadTimeHours: value } : row)),
                    )
                  }
                  onRemoveRow={(tourId) => updateOverrides((rows) => rows.filter((row) => row.tourId !== tourId))}
                />
              )}
            </div>
          )}

          {tab === 'history' && (
            <JobRunsList jobKey={job.key} runs={runs} emptySubtitle={historyEmptySubtitle(job, copy, locale)} />
          )}
        </div>
      </div>

      <UnsavedChangesModal open={guard.isBlocking} onCancel={guard.cancel} onConfirm={guard.confirm} />
    </DataEntryScreenLayout>
  )
}

function historyEmptySubtitle(job: ScheduledJobInfoModel, copy: JobsCopy, locale: Locale): string {
  if (job.nextRunAtUtc) {
    return copy.historyEmptyNextRun(formatYerevanUpcoming(new Date(job.nextRunAtUtc), locale, copy.today, copy.tomorrow))
  }
  return copy.historyEmptyDisabled
}

/** Small "не сохранено" pill — exact hand-off table value, used only on this page's summary rows
 * (both the built-in ones above and `JobParametersCard`'s dynamic ones), not worth promoting to
 * `shared/ui` for a single caller. */
function UnsavedBadge({ label }: { label: string }) {
  return (
    <span className="ml-1.5 inline-block rounded border border-neutral-300 bg-neutral-50 px-[5px] align-middle text-[9.5px] font-bold tracking-[.08em] text-neutral-600 uppercase">
      {label}
    </span>
  )
}
