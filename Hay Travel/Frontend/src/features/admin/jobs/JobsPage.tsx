import { useState } from 'react'
import { redirect, useLoaderData, useRevalidator } from 'react-router'
import { HelpButton } from '@/shared/ui/HelpButton'
import { HelpRevealZone } from '@/shared/ui/HelpReveal'
import { AdminScreen, canView, ensurePermissionsReady, useScreenPermission } from '@/shared/auth'
import { useCopy } from '@/shared/i18n/defineCopy'
import { getJobs, runJob } from '@/features/admin/api/adminJobs'
import { jobsCopy } from './lib/jobsCopy'
import { jobPermissionHints } from './lib/jobsPermissionHints'
import { JobRow } from './components/JobRow'

/** Gated by its own `jobs` key (`AdminScreens.cs`'s `ViewUpdate`) — same redirect-not-403
 * convention as every other admin loader (`notificationsLoader`, `ordersLoader`). */
export async function jobsLoader() {
  await ensurePermissionsReady()
  if (!canView(AdminScreen.Jobs)) throw redirect('/admin')

  const jobs = await getJobs()
  return { jobs }
}

/**
 * «Фоновые задачи» · экран 1 (mockup §02) — read-only list plus one instant action ("Запустить").
 * Everything that CHANGES a job's own settings lives one click away, on `JobDetailPage`: this
 * screen answers "is anything broken?" in one glance (a red left edge on a failed row is the
 * only colour spent here) and never edits a draft.
 */
export function JobsPage() {
  const { jobs } = useLoaderData<typeof jobsLoader>()
  const copy = useCopy(jobsCopy)
  const revalidator = useRevalidator()
  const permission = useScreenPermission(AdminScreen.Jobs)
  const hints = jobPermissionHints(permission, copy.readOnlyHint)

  /** Keys with a "Запустить" request in flight — disables the button synchronously on click,
   * before the server answers (checklist §11). Cleared once the loader has revalidated, whether
   * the run was accepted or the job was already running. */
  const [pendingRunKeys, setPendingRunKeys] = useState<Set<string>>(new Set())

  function handleRun(key: string) {
    if (pendingRunKeys.has(key)) return
    setPendingRunKeys((prev) => new Set(prev).add(key))
    void runJob(key)
      .catch(() => undefined) // Errors here are silent-by-design on the LIST screen: the row's
      // own state (badge/next-run) is the feedback, and a page-level error banner would need a
      // dismiss affordance this simple list doesn't otherwise have. `JobDetailPage`'s own
      // "Запустить сейчас" DOES surface a banner — this is the quick, low-stakes list shortcut.
      .finally(() => {
        void revalidator.revalidate()
        setPendingRunKeys((prev) => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      })
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div>
        <HelpRevealZone as="h1" className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-neutral-900">
          {copy.title}
          <HelpButton surface="admin" title={copy.title}>
            {copy.titleHint}
          </HelpButton>
        </HelpRevealZone>
      </div>

      {jobs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-12 text-center text-sm text-neutral-500">
          {copy.empty}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <div className="hidden items-center gap-4 border-b border-neutral-200 bg-neutral-50 px-4 py-[9px] text-[11px] font-semibold tracking-[.05em] text-neutral-500 uppercase sm:flex">
            <span className="flex-1">{copy.colJobAndLastRun}</span>
            <span className="w-[176px]">{copy.colNextRun}</span>
            <span className="w-[132px]">{copy.colState}</span>
            <span className="w-[150px]" />
          </div>

          {jobs.map((job) => (
            <JobRow
              key={job.key}
              job={job}
              runPending={pendingRunKeys.has(job.key)}
              onRun={() => handleRun(job.key)}
              runHint={hints.update}
            />
          ))}
        </div>
      )}
    </div>
  )
}
