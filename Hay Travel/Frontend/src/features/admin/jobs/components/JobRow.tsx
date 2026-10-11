import { Link } from 'react-router'
import { Tooltip } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { jobsCopy } from '../lib/jobsCopy'
import { formatYerevanRelativeShort, formatYerevanUpcoming } from '../lib/jobsTime'
import { cronToPreset, scheduleFrequencyLabel } from '../lib/jobsModel'
import { JobStatusBadge } from './JobStatusBadge'
import { JobRunStatus, type ScheduledJobInfoModel } from '@/features/admin/types/jobs'

export interface JobRowProps {
  job: ScheduledJobInfoModel
  /** Disabled synchronously the moment "Запустить" is clicked, before the server answers
   * (checklist §11 "двойной клик") — kept by the PAGE (`pendingRunKeys`), not local state, so a
   * loader revalidation replacing this whole row doesn't lose the pending flag mid-flight. */
  runPending: boolean
  onRun: () => void
  runHint: string | null
}

export function JobRow({ job, runPending, onRun, runHint }: JobRowProps) {
  const copy = useCopy(jobsCopy)
  const { locale } = useLocale()

  const preset = cronToPreset(job.cronExpression)
  const frequency = scheduleFrequencyLabel(preset, copy)

  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 border-t border-neutral-100 px-4 py-3.5 first:border-t-0 lg:grid-cols-[minmax(0,1fr)_176px_132px_auto_auto] lg:gap-4 ${
        job.isEnabled ? '' : 'bg-neutral-50'
      } ${
        job.lastRun && job.lastRun.status === JobRunStatus.Failed
          ? 'shadow-[inset_3px_0_0_theme(colors.red.600)]'
          : job.lastRun && job.lastRun.status === JobRunStatus.Running
            ? 'shadow-[inset_3px_0_0_theme(colors.amber.500)]'
            : ''
      }`}
    >
      <div className="col-span-2 min-w-0 lg:col-span-1">
        <Link
          to={`/admin/jobs/${job.key}`}
          className={`inline-block text-[15px] font-semibold hover:underline hover:underline-offset-2 ${
            job.isEnabled ? 'text-neutral-900' : 'text-neutral-500'
          }`}
        >
          {job.displayName}
        </Link>
        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
          {job.lastRun ? (
            <>
              <JobStatusBadge status={job.lastRun.status} />
              {/* The one line the mockup's job-list row shows next to the badge (§02) — the
                  ERROR takes precedence over the summary on a failed run, since that is what an
                  admin scanning the list actually needs to see first. Truncated by `truncate`,
                  never wrapped (mockup's own caption: "обрезана многоточием ... и никогда не
                  переносится"). This is data, not an explanation of how the screen works, so
                  rule §03's "no inline sentences" does not apply to it — the rule that DOES apply
                  here is §04/§07's opposite one, and it is scoped to the History TAB's rows
                  (`JobRunsList`), which never render `summary`/`error` at all. */}
              {(job.lastRun.error ?? job.lastRun.summary) && (
                <span className="min-w-0 truncate text-[13px] text-neutral-600">
                  {job.lastRun.error ?? job.lastRun.summary}
                </span>
              )}
              <span className="shrink-0 text-xs text-neutral-400">
                {formatYerevanRelativeShort(job.lastRun.startedAtUtc, locale, copy.today, copy.yesterday)}
              </span>
            </>
          ) : (
            <span className="text-[13px] text-neutral-400">{copy.neverRun}</span>
          )}
        </div>
      </div>

      <div className="col-span-2 flex items-baseline gap-2 lg:col-span-1 lg:block">
        <div className="text-[10px] font-semibold tracking-[.08em] text-neutral-400 uppercase">{copy.nextLabel}</div>
        {job.nextRunAtUtc ? (
          <div className="mt-0.5 text-[13px] tabular-nums text-neutral-800">
            {formatYerevanUpcoming(new Date(job.nextRunAtUtc), locale, copy.today, copy.tomorrow)}
            <span className="block text-xs text-neutral-400">{frequency}</span>
          </div>
        ) : (
          <div className="mt-0.5 text-[13px] text-neutral-400">
            {copy.notScheduled}
            <span className="block text-xs text-neutral-400">{copy.disabledSub}</span>
          </div>
        )}
      </div>

      <div className="col-start-1 row-start-2 lg:col-start-3 lg:row-start-1">
        <span className={`inline-flex items-center gap-1.5 text-[12.5px] ${job.isEnabled ? 'text-neutral-700' : 'text-neutral-400'}`}>
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${job.isEnabled ? 'bg-neutral-900' : 'bg-transparent shadow-[inset_0_0_0_1.5px_theme(colors.neutral.400)]'}`}
          />
          {job.isEnabled ? copy.stateEnabled : copy.stateDisabled}
        </span>
      </div>

      <div className="col-start-2 row-start-2 justify-self-end lg:col-start-4 lg:row-start-1 lg:justify-self-auto">
        <Tooltip enabled={Boolean(runHint)} content={runHint} cursor="not-allowed">
          <button
            type="button"
            disabled={runPending || Boolean(runHint)}
            onClick={onRun}
            className="inline-flex h-9 cursor-pointer items-center justify-center rounded-full border border-neutral-300 bg-white px-4 text-[13px] font-semibold text-neutral-900 whitespace-nowrap transition-colors hover:border-neutral-400 hover:bg-neutral-50 disabled:pointer-events-none disabled:opacity-[.42]"
          >
            {runPending ? copy.runButtonPending : copy.runButton}
          </button>
        </Tooltip>
      </div>

      <Link
        to={`/admin/jobs/${job.key}`}
        aria-label={copy.openJobAria(job.displayName)}
        className="hidden shrink-0 rounded-lg p-1.5 text-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900 lg:block"
      >
        →
      </Link>
    </div>
  )
}
