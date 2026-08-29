import { Link } from 'react-router'
import { HelpButton } from '@/shared/ui/HelpButton'
import { HelpRevealZone } from '@/shared/ui/HelpReveal'
import { ClockIcon } from '@/shared/ui/icons'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { jobsCopy } from '../lib/jobsCopy'
import { formatYerevanDateTime } from '../lib/jobsTime'
import { JobStatusBadge } from './JobStatusBadge'
import { JobRunStatus, type ScheduledJobRunInfoModel } from '@/features/admin/types/jobs'

export interface JobRunsListProps {
  jobKey: string
  runs: ScheduledJobRunInfoModel[]
  /** What to show under the empty-state title when `runs.length === 0` — "Первый запуск — …" or
   * "Задача выключена — расписания нет." (the page knows `nextRunAtUtc`, this component doesn't
   * need to). */
  emptySubtitle: string
}

/**
 * Compact history rows (mockup §07): time, result, how much was affected, and a link-button to
 * the full report — deliberately NOT `summary`/`error`, in any form, ever (that is the whole
 * point of the separate report route). `<Link>`, not `onClick` (hand-off table: must open in a
 * new tab on Ctrl+click).
 */
export function JobRunsList({ jobKey, runs, emptySubtitle }: JobRunsListProps) {
  const copy = useCopy(jobsCopy)
  const { locale } = useLocale()

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-10 text-center">
        <ClockIcon size={26} className="text-neutral-300" />
        <p className="text-sm font-semibold text-neutral-900">{copy.historyEmptyTitle}</p>
        <p className="max-w-xs text-sm text-neutral-500">{emptySubtitle}</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="flex items-center gap-3.5 border-b border-neutral-200 bg-neutral-50 px-4 py-[9px] text-[11px] font-semibold tracking-[.05em] text-neutral-500 uppercase">
        <span className="w-[170px] shrink-0">{copy.historyColTime}</span>
        <span className="w-[120px] shrink-0">{copy.historyColResult}</span>
        <span className="flex-1">{copy.historyColAffected}</span>
        <span className="w-[150px] shrink-0" />
      </div>

      {runs.map((run) => (
        <div
          key={run.id}
          className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-neutral-100 px-4 py-[11px] first:border-t-0 sm:grid-cols-[170px_120px_minmax(0,1fr)_auto] sm:gap-3.5 ${
            run.status === JobRunStatus.Failed
              ? 'shadow-[inset_3px_0_0_theme(colors.red.600)]'
              : run.status === JobRunStatus.Running
                ? 'shadow-[inset_3px_0_0_theme(colors.amber.500)]'
                : ''
          }`}
        >
          <time className="col-start-1 row-start-1 text-[13.5px] whitespace-nowrap tabular-nums text-neutral-800">
            {formatYerevanDateTime(run.startedAtUtc, locale)}
            <span className="block text-[11.5px] text-neutral-400">
              {copy.triggeredByLabels[run.triggeredBy] ?? ''}
            </span>
          </time>
          <span className="col-start-2 row-start-1 justify-self-end sm:justify-self-auto">
            <JobStatusBadge status={run.status} />
          </span>
          <span className="col-start-1 row-start-2 self-center text-[13.5px] tabular-nums text-neutral-800 sm:col-start-3 sm:row-start-1">
            {run.status === JobRunStatus.Failed ? (
              <span className="text-neutral-400">{copy.affectedDash}</span>
            ) : (
              copy.affectedUnit(run.affectedCount)
            )}
          </span>
          <span className="col-start-2 row-start-2 justify-self-end sm:col-start-4 sm:row-start-1">
            <Link
              to={`/admin/jobs/${jobKey}/runs/${run.id}`}
              className="inline-flex h-[34px] items-center justify-center rounded-full border border-neutral-300 bg-white px-3.5 text-[12.5px] font-semibold text-neutral-900 transition-colors hover:border-neutral-400 hover:bg-neutral-50 sm:h-11"
            >
              {copy.reportButton}
            </Link>
          </span>
        </div>
      ))}

      <HelpRevealZone className="flex items-center gap-2 border-t border-neutral-100 bg-neutral-50 px-4 py-[9px] text-xs text-neutral-500">
        {copy.historyFooterShown(runs.length)}
        <HelpButton surface="admin" title={copy.historyColTime}>
          {copy.historyRetentionHint}
        </HelpButton>
      </HelpRevealZone>
    </div>
  )
}
