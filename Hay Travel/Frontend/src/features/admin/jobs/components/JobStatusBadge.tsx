import { useCopy } from '@/shared/i18n/defineCopy'
import { jobsCopy } from '../lib/jobsCopy'
import { jobStatusTone, type JobStatusTone } from '../lib/jobsModel'

export interface JobStatusBadgeProps {
  /** `JobRunStatus` off the wire, as a plain number — see `jobStatusTone`'s doc comment for why
   * this is never narrowed to the `JobRunStatus` union at the prop boundary. */
  status: number
  className?: string
}

const TONE_CLASSES: Record<JobStatusTone, string> = {
  ok: 'border border-neutral-300 bg-white text-neutral-700',
  skip: 'border border-neutral-200 bg-neutral-50 text-neutral-500',
  fail: 'border border-red-200 bg-red-50 text-red-700',
  // Amber/orange, not the same solid-black treatment the other tones avoid on purpose — "выполняется
  // сейчас" is a distinct third state from "settled ok/grey" and "settled failure/red" (David's fix
  // request 2026-08-29: unify every "running" indicator on this screen to one yellow-orange tone).
  run: 'border border-amber-300 bg-amber-50 text-amber-800',
  unknown: 'border border-neutral-200 bg-neutral-100 text-neutral-600',
}

const DOT_CLASSES: Record<JobStatusTone, string> = {
  ok: 'bg-neutral-900',
  skip: 'bg-transparent shadow-[inset_0_0_0_1.5px_theme(colors.neutral.400)]',
  fail: 'bg-red-600',
  run: 'bg-amber-500 animate-pulse',
  unknown: 'hidden',
}

/**
 * Run-status pill for the whole screen (list row, summary panel, history row, run-report header)
 * — one component, one number→tone table (mockup §04/§11), so the rule "colour is spent ONLY on
 * failure" cannot drift between the four places a status renders. An unrecognised `status` number
 * (the mockup's own worry: "сервер добавит пятый статус") renders neutral grey WITH the raw
 * number in the label — never a crash, never a silently wrong colour.
 */
export function JobStatusBadge({ status, className = '' }: JobStatusBadgeProps) {
  const copy = useCopy(jobsCopy)
  const tone = jobStatusTone(status)
  const label = copy.statusLabels[status] ?? copy.unknownStatus(status)

  return (
    <span
      className={`inline-flex h-6 items-center gap-[7px] rounded-full px-2.5 text-[11px] font-bold tracking-[.06em] whitespace-nowrap uppercase ${TONE_CLASSES[tone]} ${className}`}
    >
      <span aria-hidden="true" className={`h-[7px] w-[7px] shrink-0 rounded-full ${DOT_CLASSES[tone]}`} />
      {label}
    </span>
  )
}
