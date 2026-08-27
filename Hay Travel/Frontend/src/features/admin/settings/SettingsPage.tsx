import { redirect, useLoaderData } from 'react-router'
import { SetupFormLayout, UnsavedChangesModal } from '@/shared/ui'
import { useUnsavedChangesGuard } from '@/shared/hooks'
import { useCopy } from '@/shared/i18n/defineCopy'
import {
  AdminScreen,
  canView,
  ensurePermissionsReady,
  useScreenPermission,
} from '@/shared/auth'
import { getAllSiteSettings } from '@/features/admin/api/adminSiteSettings'
import { SingleRecordIdentity } from '@/features/admin/ui/SingleRecordIdentity'
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
 * record. Hence no control zone at the top at all (Add/Delete do not exist here), the identity
 * strip instead, and the single Save pinned in the layout's `footer`.
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

  return (
    <SetupFormLayout
      title={copy.title}
      subtitle={copy.subtitle}
      identity={
        <SingleRecordIdentity
          name={copy.title}
          badge={copy.identityBadge}
          note={copy.identitySections(state.sections.length)}
        />
      }
      /* The fields stay editable-looking but «Сохранить» never enables — a read-only settings
         screen is still worth opening, and an explanation beats a mysteriously dead button. */
      message={
        !permission.canUpdate && (
          <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
            {copy.readOnlyHint}
          </p>
        )
      }
      /* Nothing to save when the server returned no settings at all — the bar would only offer a
         permanently dead button under an empty state that already explains itself. */
      footer={
        isEmpty ? undefined : (
          <SettingsActions
            dirtyCount={dirtyCount}
            isValid={validation.isValid}
            hasAttemptedSubmit={hasAttemptedSubmit}
            canSubmit={canSubmit && permission.canUpdate}
            isSubmitting={isSubmitting}
            error={error}
            savedAt={savedAt}
            onSubmit={submit}
          />
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
