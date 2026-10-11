import { redirect, useLoaderData } from 'react-router'
import { SetupFormLayout, UnsavedChangesModal } from '@/shared/ui'
import { AlertIcon } from '@/shared/ui/icons'
import { useUnsavedChangesGuard } from '@/shared/hooks'
import { useCopy } from '@/shared/i18n/defineCopy'
import {
  AdminScreen,
  canView,
  ensurePermissionsReady,
  useScreenPermission,
} from '@/shared/auth'
import { getAllSiteSettings } from '@/features/admin/api/adminSiteSettings'
import { useSettingsForm } from './hooks/useSettingsForm'
import { settingsCopy } from './lib/settingsCopy'
import { SettingsForm } from './components/SettingsForm'
import { SettingsActions } from './components/SettingsActions'

/**
 * Loads the whole settings catalog. Errors are NOT swallowed — a rejection propagates to
 * `AdminErrorBoundary`, exactly like `productsLoader`.
 *
 * Gated by `settings.View`; anyone else who types the URL is sent back to the dashboard rather than
 * shown a raw 403.
 */
export async function settingsLoader() {
  await ensurePermissionsReady()
  if (!canView(AdminScreen.Settings)) throw redirect('/admin')

  const settings = await getAllSiteSettings()
  return { settings }
}

/**
 * Container of the settings screen: it owns the form state (through `useSettingsForm`) and the
 * unsaved-changes guard, and hands everything else to presentational components.
 *
 * Template C — «Форма настройки» (`SetupFormLayout`). This screen is the archetype's own reference
 * example: exactly one record, forever — there is no list route and no `/:id`, the screen IS the
 * record. Add/Delete do not exist here, so the pinned control zone at the top carries only
 * Отмена/Сохранить (`AdminToolbar`, решение Давида 2026-10-11 — раньше это была нижняя панель
 * `footer`) plus the "N несохранённых изменений" counter.
 *
 * The template's identity strip is deliberately NOT rendered (removed 2026-08-29): with the tabs
 * right below it, "единственная запись · N разделов" restated what the screen already showed.
 *
 * State is seeded from the loader once, via the hook's lazy initializer, and lives locally
 * afterwards — saving replaces it with the server's own response, so the loader is never
 * revalidated.
 */
export function SettingsPage() {
  const copy = useCopy(settingsCopy)
  const { settings } = useLoaderData<typeof settingsLoader>()
  const permission = useScreenPermission(AdminScreen.Settings)
  const {
    state,
    actions,
    dirtyCount,
    reset,
    validation,
    canSubmit,
    hasAttemptedSubmit,
    submit,
    isSubmitting,
    error,
    savedAt,
  } = useSettingsForm(settings)

  const guard = useUnsavedChangesGuard(dirtyCount > 0 && !isSubmitting)

  const isEmpty = state.sections.length === 0
  const showInvalidWarning = hasAttemptedSubmit && !validation.isValid

  return (
    <SetupFormLayout
      title={copy.title}
      subtitle={copy.subtitle}
      /* Nothing to save when the server returned no settings at all — the toolbar would only
         offer permanently dead buttons under an empty state that already explains itself. */
      controlZone={
        !isEmpty && (
          <SettingsActions
            dirtyCount={dirtyCount}
            canSubmit={canSubmit}
            canUpdate={permission.canUpdate}
            isSubmitting={isSubmitting}
            savedAt={savedAt}
            onSubmit={submit}
            onCancel={reset}
          />
        )
      }
      /* The fields stay editable-looking but «Сохранить» never enables — a read-only settings
         screen is still worth opening, and an explanation beats a mysteriously dead button. */
      message={
        (!permission.canUpdate || error || showInvalidWarning) && (
          <>
            {!permission.canUpdate && (
              <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                {copy.readOnlyHint}
              </p>
            )}
            {(error || showInvalidWarning) && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
              >
                <AlertIcon size={16} className="mt-0.5 shrink-0" />
                <span>{error ?? copy.invalidForm}</span>
              </div>
            )}
          </>
        )
      }
    >
      {isEmpty ? (
        <div className="rounded-xl border border-neutral-200 bg-white px-6 py-14 text-center">
          <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
            <span aria-hidden="true" className="mb-2 text-2xl">
              ⚙
            </span>
            <h2 className="text-base font-semibold text-neutral-800">{copy.emptyTitle}</h2>
            <p className="text-sm text-neutral-500">{copy.emptyText}</p>
          </div>
        </div>
      ) : (
        <SettingsForm state={state} actions={actions} validation={validation} onSubmit={submit} />
      )}

      <UnsavedChangesModal open={guard.isBlocking} onCancel={guard.cancel} onConfirm={guard.confirm} />
    </SetupFormLayout>
  )
}
