import { useState } from 'react'
import { redirect, useLoaderData, useRevalidator } from 'react-router'
import { AdminToolbar, DataEntryScreenLayout, UnsavedChangesModal } from '@/shared/ui'
import { AlertIcon, CheckIcon } from '@/shared/ui/icons'
import { HelpButton } from '@/shared/ui/HelpButton'
import { HelpRevealZone } from '@/shared/ui/HelpReveal'
import { useUnsavedChangesGuard } from '@/shared/hooks'
import { AdminScreen, canView, ensurePermissionsReady, useScreenPermission } from '@/shared/auth'
import { useCopy } from '@/shared/i18n/defineCopy'
import { getJobScreenParameters, getJobs, runJob, setJobScreenParameters } from '@/features/admin/api/adminJobs'
import { SettingValueType } from '@/features/admin/lib/enums'
import { jobsCopy, jobsErrorMessage } from './lib/jobsCopy'
import { isValidParameterNumber, parameterValuesEqual } from './lib/jobsModel'
import { jobPermissionHints } from './lib/jobsPermissionHints'
import { JobParametersCard } from './components/JobParametersCard'
import { JobRow } from './components/JobRow'

/** Gated by its own `jobs` key (`AdminScreens.cs`'s `ViewUpdate`) — same redirect-not-403
 * convention as every other admin loader (`notificationsLoader`, `ordersLoader`).
 *
 * Два независимых GET параллельно (та же форма, что у `jobDetailLoader`): список задач и
 * параметры самого экрана — второе не поле первого, см. `adminJobs.ts#getJobScreenParameters`. */
export async function jobsLoader() {
  await ensurePermissionsReady()
  if (!canView(AdminScreen.Jobs)) throw redirect('/admin')

  const [jobs, screenParameters] = await Promise.all([getJobs(), getJobScreenParameters()])
  return { jobs, screenParameters }
}

/**
 * «Фоновые задачи» · экран 1 (mockup §02) — список задач с одним немедленным действием
 * («Запустить»), плюс карточка параметров САМОГО экрана: настроек, которые читает планировщик
 * для всех задач сразу, а не какая-то одна задача (сегодня — глубина хранения истории прогонов).
 *
 * Пороги конкретной задачи по-прежнему живут на её карточке (`JobDetailPage`) — экран владеет
 * своими параметрами, и общий параметр, приписанный к строке одной из задач, читался бы как её
 * собственный. Правка — черновиком с `AdminToolbar`, как на всех редактируемых экранах админки,
 * а не мгновенным применением.
 */
export function JobsPage() {
  const { jobs, screenParameters } = useLoaderData<typeof jobsLoader>()
  const copy = useCopy(jobsCopy)
  const revalidator = useRevalidator()
  const permission = useScreenPermission(AdminScreen.Jobs)
  const hints = jobPermissionHints(permission, copy.readOnlyHint)

  /** Keys with a "Запустить" request in flight — disables the button synchronously on click,
   * before the server answers (checklist §11). Cleared once the loader has revalidated, whether
   * the run was accepted or the job was already running. */
  const [pendingRunKeys, setPendingRunKeys] = useState<Set<string>>(new Set())

  /** Черновик параметров экрана: только тронутые ключи («отсутствует = не менялось» — та же
   * конвенция, что у `JobDetailPage`'s `JobDraft.parameters` и `OrderDetailPage`'s
   * `LineDraftPatch`). */
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [savePending, setSavePending] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)

  const dirtyKeys = Object.keys(draft).filter((key) => {
    const parameter = screenParameters.find((candidate) => candidate.key === key)
    if (!parameter) return false
    return !parameterValuesEqual(draft[key], parameter.value, parameter.valueType === SettingValueType.Number)
  })
  const dirty = dirtyKeys.length > 0
  const draftValid = dirtyKeys.every((key) => {
    const parameter = screenParameters.find((candidate) => candidate.key === key)
    if (parameter?.valueType !== SettingValueType.Number) return true
    return isValidParameterNumber(draft[key])
  })

  const guard = useUnsavedChangesGuard(dirty && !savePending)

  async function handleSaveScreenParameters() {
    if (savePending || !dirty || !draftValid || hints.update !== null) return
    setSavePending(true)
    setSaveError(null)
    setSaveNotice(null)
    try {
      const values: Record<string, string> = {}
      for (const key of dirtyKeys) values[key] = draft[key]
      await setJobScreenParameters({ values })
      setDraft({})
      setSaveNotice(copy.screenParametersSavedBanner)
      await revalidator.revalidate()
    } catch (err) {
      setSaveError(jobsErrorMessage(copy, err, copy.errorActions.save))
    } finally {
      setSavePending(false)
    }
  }

  /** Значение, вернувшееся к сохранённому, из черновика выкидывается — dirty считается по отличию
   * от baseline, а не по факту «поле трогали». */
  function handleParameterChange(key: string, value: string) {
    const saved = screenParameters.find((parameter) => parameter.key === key)?.value
    setDraft((prev) => {
      const next = { ...prev }
      if (value === saved) delete next[key]
      else next[key] = value
      return next
    })
  }

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
    <DataEntryScreenLayout
      title={
        <HelpRevealZone as="span" className="flex items-center gap-2">
          {copy.title}
          <HelpButton surface="admin" title={copy.title}>
            {copy.titleHint}
          </HelpButton>
        </HelpRevealZone>
      }
      subtitle={copy.subtitle}
      controlZone={
        screenParameters.length > 0 && (
          <AdminToolbar
            onCancel={() => setDraft({})}
            onSave={() => void handleSaveScreenParameters()}
            cancelState={{ disabled: savePending || !dirty }}
            saveState={{
              disabled: savePending || !dirty || !draftValid || hints.update !== null,
              pending: savePending,
              hint: hints.update,
            }}
          />
        )
      }
      message={
        (saveError || saveNotice) && (
          <>
            {saveError && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertIcon size={16} className="mt-0.5 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}
            {saveNotice && (
              <div role="status" className="flex items-start gap-2 rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-900">
                <CheckIcon size={16} className="mt-0.5 shrink-0" />
                <span>{saveNotice}</span>
              </div>
            )}
          </>
        )
      }
    >
      {jobs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-12 text-center text-sm text-neutral-500">
          {copy.empty}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <div className="hidden items-center gap-4 border-b border-neutral-200 bg-neutral-50 px-4 py-[9px] text-[11px] font-semibold tracking-[.05em] text-neutral-500 uppercase lg:flex">
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

      <JobParametersCard
        parameters={screenParameters}
        draftValues={draft}
        onChange={handleParameterChange}
        disabled={savePending || hints.update !== null}
        title={copy.screenParametersCardTitle}
        titleHint={copy.screenParametersCardHint}
      />

      <UnsavedChangesModal open={guard.isBlocking} onCancel={guard.cancel} onConfirm={guard.confirm} />
    </DataEntryScreenLayout>
  )
}
