import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Link, redirect, useLoaderData, useRevalidator } from 'react-router'
import type { LoaderFunctionArgs } from 'react-router'
import { InquiryScreenLayout, buttonClassName } from '@/shared/ui'
import { AdminScreen, canView, ensurePermissionsReady } from '@/shared/auth'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { getStoredLocale } from '@/shared/lib/locale'
import { getJobRun } from '@/features/admin/api/adminJobs'
import { JobRunStatus, JobTriggerType } from '@/features/admin/types/jobs'
import { jobsCopy } from './lib/jobsCopy'
import { formatDurationSeconds, formatYerevanDateTime, formatYerevanClock } from './lib/jobsTime'
import { JobStatusBadge } from './components/JobStatusBadge'

/**
 * Loads the ONE run directly by id (`GET api/Jobs/{key}/Runs/{runId}`) — never by searching
 * `JobsPage`/`JobDetailPage`'s already-loaded lists, so a page refresh or a direct link both
 * work (checklist §11: "Отчёт — настоящий маршрут"). A missing/expired run is NOT thrown as a
 * generic 404 to `AdminErrorBoundary` — `getJobRun` already turns that into `null`, and this page
 * renders its own "Прогон не найден" empty state with a way back (mockup §08's explicit
 * requirement: "ссылка живёт дольше прогона").
 */
export async function jobRunReportLoader({ params }: LoaderFunctionArgs) {
  await ensurePermissionsReady()
  if (!canView(AdminScreen.Jobs)) throw redirect('/admin')

  const key = params.key ?? ''
  const runId = Number(params.runId)
  if (!Number.isInteger(runId) || runId <= 0) {
    throw new Response(jobsCopy(getStoredLocale()).notFoundBody, { status: 400 })
  }

  const run = await getJobRun(key, runId)
  return { key, run }
}

/** «Экран 3 · Отчёт о прогоне» (mockup §08) — read-only, no toolbar, no draft: шаблон D
 * (`InquiryScreenLayout`) с крошками, тот же каркас «колонка + сводка справа», что у `JobDetailPage`. */
export function JobRunReportPage() {
  const { key, run } = useLoaderData<typeof jobRunReportLoader>()
  const copy = useCopy(jobsCopy)
  const { locale } = useLocale()
  const revalidator = useRevalidator()

  const isRunning = run?.status === JobRunStatus.Running
  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => void revalidator.revalidate(), 3000)
    return () => clearInterval(id)
  }, [isRunning, revalidator])

  const jobName = copy.jobDisplayNameByKey[key] ?? key

  const jobsCrumb = (
    <Link to="/admin/jobs" className="transition-colors hover:text-neutral-800">
      {copy.backToList}
    </Link>
  )
  const jobCrumb = (
    <Link to={`/admin/jobs/${key}`} className="transition-colors hover:text-neutral-800">
      {jobName}
    </Link>
  )

  if (!run) {
    return (
      <InquiryScreenLayout
        breadcrumbs={
          <>
            {jobsCrumb}
            <span aria-hidden="true"> · </span>
            {jobCrumb}
          </>
        }
        breadcrumbsLabel={copy.breadcrumbsLabel}
        title={copy.notFoundTitle}
        subtitle={
          <>
            {jobName} · <span className="font-mono text-xs text-neutral-700">{key}</span>
          </>
        }
      >
        <div className="flex flex-col items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-14 text-center">
          <p className="max-w-sm text-sm text-neutral-500">{copy.notFoundBody}</p>
          <Link to={`/admin/jobs/${key}`} className={`mt-1 ${buttonClassName('secondary', 'md')}`}>
            {copy.notFoundBack}
          </Link>
        </div>
      </InquiryScreenLayout>
    )
  }

  const when = formatYerevanDateTime(run.startedAtUtc, locale)
  const duration = formatDurationSeconds(run.startedAtUtc, run.finishedAtUtc, locale)

  return (
    <InquiryScreenLayout
      breadcrumbs={
        <>
          {jobsCrumb}
          <span aria-hidden="true"> · </span>
          {jobCrumb}
          <span aria-hidden="true"> · </span>
          <span className="font-semibold text-neutral-800">{copy.runCrumb(when)}</span>
        </>
      }
      breadcrumbsLabel={copy.breadcrumbsLabel}
      title={
        <span className="flex flex-wrap items-center gap-2">
          {copy.runCrumb(when)}
          <JobStatusBadge status={run.status} />
        </span>
      }
      subtitle={
        <>
          {jobName} · <span className="font-mono text-xs text-neutral-700">{key}</span>
        </>
      }
      controlZone={
        <Link
          to={`/admin/jobs/${key}`}
          className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-neutral-600 transition-colors hover:text-neutral-900"
        >
          {copy.backToHistory}
        </Link>
      }
    >
      {/* Панель прогона — справа на десктопе и первой на мобиле; слева — ошибка и отчёт. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white lg:order-2 lg:self-start">
          <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 text-[11px] font-bold tracking-[.12em] text-neutral-500 uppercase">
            {copy.runPanelTitle}
          </div>
          <dl className="flex flex-col px-4">
            <SummaryRow label={copy.fieldStart} value={formatYerevanDateTime(run.startedAtUtc, locale)} first />
            <SummaryRow
              label={copy.fieldEnd}
              value={run.finishedAtUtc ? formatYerevanClock(run.finishedAtUtc, locale) : copy.stillRunningDash}
            />
            <SummaryRow label={copy.fieldDuration} value={duration ?? copy.stillRunningDash} />
            <SummaryRow
              label={copy.fieldTrigger}
              value={
                run.triggeredBy === JobTriggerType.Manual ? (
                  <>
                    {copy.triggeredByManualField}
                    {run.actorFullName && <span className="mt-0.5 block text-xs font-normal text-neutral-400">{run.actorFullName}</span>}
                  </>
                ) : (
                  copy.triggeredByScheduleField
                )
              }
            />
            <SummaryRow label={copy.fieldAffected} value={String(run.affectedCount)} />
          </dl>
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:order-1">
          {run.status === JobRunStatus.Failed && run.error && (
            <div className="rounded-xl border border-neutral-200 bg-white p-[18px]">
              <p className="mb-3.5 text-[11px] font-bold tracking-[.1em] text-neutral-500 uppercase">{copy.errorCardTitle}</p>
              <pre className="overflow-x-auto rounded-lg border border-red-200 bg-red-50 p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-red-700">
                {run.error}
              </pre>
            </div>
          )}

          {run.summary && (
            <div className="rounded-xl border border-neutral-200 bg-white p-[18px]">
              <p className="mb-3.5 text-[11px] font-bold tracking-[.1em] text-neutral-500 uppercase">{copy.reportCardTitle}</p>
              <p className="max-w-[80ch] text-sm leading-relaxed whitespace-pre-wrap text-neutral-800">{run.summary}</p>
            </div>
          )}
        </div>
      </div>
    </InquiryScreenLayout>
  )
}

function SummaryRow({ label, value, first = false }: { label: string; value: ReactNode; first?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-2 ${first ? '' : 'border-t border-neutral-100'}`}>
      <dt className="min-w-0 truncate text-sm text-neutral-500">{label}</dt>
      <dd className="shrink-0 text-right text-sm font-semibold tabular-nums text-neutral-900">{value}</dd>
    </div>
  )
}
