import { useEffect, useState } from 'react'
import { Link, redirect, useLoaderData, useRevalidator } from 'react-router'
import type { LoaderFunctionArgs } from 'react-router'
import { AdminActionButton, AdminSummaryPanel, AdminToolbar, Tabs, Tooltip, UnsavedChangesModal, type AdminSummaryRow, type TabItem } from '@/shared/ui'
import { HelpButton } from '@/shared/ui/HelpButton'
import { HelpRevealZone } from '@/shared/ui/HelpReveal'
import { PlayIcon } from '@/shared/ui/icons'
import { useUnsavedChangesGuard } from '@/shared/hooks'
import { AdminScreen, canView, ensurePermissionsReady, useScreenPermission } from '@/shared/auth'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { getStoredLocale, type Locale } from '@/shared/lib/locale'
import { getJobRuns, getJobs, runJob, setJobCron, setJobEnabled, setJobParameters } from '@/features/admin/api/adminJobs'
import { SettingValueType } from '@/features/admin/lib/enums'
import type { ScheduledJobInfoModel, ScheduledJobRunInfoModel } from '@/features/admin/types/jobs'
import { jobsCopy, jobsErrorMessage, type JobsCopy } from './lib/jobsCopy'
import { jobPermissionHints } from './lib/jobsPermissionHints'
import { capitalizeFirst, cronToPreset, isPlausibleCronExpression, isValidParameterNumber, scheduleFrequencyLabel } from './lib/jobsModel'
import { formatDurationSeconds, formatYerevanDateTime, formatYerevanUpcoming, minutesUntil } from './lib/jobsTime'
import { JobScheduleCard } from './components/JobScheduleCard'
import { JobParametersCard } from './components/JobParametersCard'
import { JobRunsList } from './components/JobRunsList'
import { JobStatusBadge } from './components/JobStatusBadge'

/** No single-job GET exists on the backend (`JobsController.cs` only has `GetAll`/mutation
 * endpoints, each of which re-reads and returns its OWN job) — so the detail route fetches the
 * whole list, same as `JobsPage`, and picks its one row out of it. Paired with `getJobRuns` for
 * the "История" tab, same "two independent GETs, in parallel" shape as `orderDetailLoader`. */
export async function jobDetailLoader({ params }: LoaderFunctionArgs) {
  await ensurePermissionsReady()
  if (!canView(AdminScreen.Jobs)) throw redirect('/admin')

  const key = params.key ?? ''
  const [jobs, runs] = await Promise.all([getJobs(), getJobRuns(key)])
  const job = jobs.find((candidate) => candidate.key === key)
  if (!job) {
    // Same loader-time-locale rule as `orderDetailLoader`'s `invalidOrderId` (defineCopy.ts §3):
    // no `useCopy` exists yet, the module is called directly against the persisted locale.
    throw new Response(jobsCopy(getStoredLocale()).errors.notFound, { status: 404 })
  }
  return { job, runs }
}

export function JobDetailPage() {
  const { job, runs } = useLoaderData<typeof jobDetailLoader>()
  // Keyed by job key: navigating between two job URLs remounts with a fresh draft/tab instead of
  // carrying the previous job's edits over — same reasoning as `OrderDetailPage`/`UserDetailPage`.
  return <JobDetailView key={job.key} job={job} runs={runs} />
}

type JobDetailTabId = 'overview' | 'history'

/** One draft for the whole page (mockup §01/§06: "Один экран — одна кнопка сохранения"). `cron`
 * carries the RAW `PATCH .../Cron` payload semantics — `''` means "reset to the catalog default"
 * — so `JobDetailView` is the one place that translates between that wire shape and the plain
 * "effective cron string" `JobScheduleCard` renders/edits. `parameters` holds only touched keys,
 * same "absent = unchanged" convention `OrderDetailPage`'s `LineDraftPatch` uses. */
interface JobDraft {
  enabled?: boolean
  cron?: string
  parameters: Record<string, string>
}

const EMPTY_DRAFT: JobDraft = { parameters: {} }

function effectiveCronOf(draftCron: string | undefined, job: ScheduledJobInfoModel): string {
  if (draftCron === undefined) return job.cronExpression
  return draftCron === '' ? job.defaultCronExpression : draftCron
}

function JobDetailView({ job, runs }: { job: ScheduledJobInfoModel; runs: ScheduledJobRunInfoModel[] }) {
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

  const enabledDirty = draft.enabled !== undefined && draft.enabled !== job.isEnabled
  const cronDirty = draft.cron !== undefined && effectiveCronOf(draft.cron, job) !== job.cronExpression
  const dirtyParamKeys = Object.keys(draft.parameters).filter((key) => {
    const original = job.parameters.find((p) => p.key === key)?.value
    return draft.parameters[key] !== original
  })
  const dirty = enabledDirty || cronDirty || dirtyParamKeys.length > 0

  const cronValid = draft.cron === undefined || isPlausibleCronExpression(draft.cron)
  const parametersValid = dirtyParamKeys.every((key) => {
    const definition = job.parameters.find((p) => p.key === key)
    if (definition?.valueType !== SettingValueType.Number) return true
    return isValidParameterNumber(draft.parameters[key])
  })

  const guard = useUnsavedChangesGuard(dirty && !pending)

  const effectiveEnabled = draft.enabled ?? job.isEnabled
  const effectiveCron = effectiveCronOf(draft.cron, job)

  async function handleSave() {
    if (pending || !dirty || !cronValid || !parametersValid || hints.update !== null) return
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <nav className="text-xs text-neutral-500" aria-label={copy.breadcrumbsLabel}>
        <Link to="/admin/jobs" className="transition-colors hover:text-neutral-800">
          {copy.backToList}
        </Link>
        <span aria-hidden="true"> · </span>
        <span className="font-semibold text-neutral-800">{job.displayName}</span>
      </nav>

      <div className="flex flex-wrap items-center gap-3">
        <AdminToolbar
          onCancel={handleCancel}
          onSave={() => void handleSave()}
          cancelState={{ disabled: pending || !dirty }}
          saveState={{
            disabled: pending || !dirty || !cronValid || !parametersValid || hints.update !== null,
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
      </div>

      {hints.update && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          {hints.update}
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span aria-hidden="true">⚠️</span>
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-900">
          <span aria-hidden="true">✓</span>
          <span>{notice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <HelpRevealZone
                as="h1"
                enabled={Boolean(helpText)}
                className="flex flex-wrap items-center gap-2 text-lg font-bold text-neutral-900"
              >
                {job.displayName}
                {helpText && (
                  <HelpButton surface="admin" title={job.displayName}>
                    {helpText}
                  </HelpButton>
                )}
              </HelpRevealZone>
              <p className="mt-0.5 text-sm text-neutral-500">
                {copy.keyLabel}: <span className="font-mono text-xs text-neutral-700">{job.key}</span>
                {job.nextRunAtUtc && (
                  <>
                    {' · '}
                    {copy.nextRunPrefix}:{' '}
                    <b className="font-semibold text-neutral-800">
                      {formatYerevanUpcoming(new Date(job.nextRunAtUtc), locale, copy.today, copy.tomorrow)}
                    </b>{' '}
                    ({copy.inMinutes(minutesUntil(job.nextRunAtUtc))})
                  </>
                )}
              </p>
            </div>
            {job.lastRun && <JobStatusBadge status={job.lastRun.status} />}
          </div>
        </div>

        <AdminSummaryPanel title={copy.summaryTitle} className="lg:self-start" rows={summaryRows} />
      </div>

      <Tabs tabs={tabs} activeId={tab} onChange={(id) => setTab(id as JobDetailTabId)} label={copy.tabsLabel} />

      {tab === 'overview' && (
        <div className="flex flex-col gap-4">
          <JobScheduleCard
            isEnabled={effectiveEnabled}
            onChangeEnabled={(next) => setDraft((prev) => ({ ...prev, enabled: next }))}
            cron={effectiveCron}
            onChangeCron={(next) =>
              setDraft((prev) => ({ ...prev, cron: next === job.defaultCronExpression ? '' : next }))
            }
            scheduleDirty={cronDirty}
            disabled={pending || hints.update !== null}
          />
          <JobParametersCard
            parameters={job.parameters}
            draftValues={draft.parameters}
            onChange={(key, value) =>
              setDraft((prev) => ({ ...prev, parameters: { ...prev.parameters, [key]: value } }))
            }
            disabled={pending || hints.update !== null}
          />
        </div>
      )}

      {tab === 'history' && (
        <JobRunsList jobKey={job.key} runs={runs} emptySubtitle={historyEmptySubtitle(job, copy, locale)} />
      )}

      <UnsavedChangesModal open={guard.isBlocking} onCancel={guard.cancel} onConfirm={guard.confirm} />
    </div>
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
