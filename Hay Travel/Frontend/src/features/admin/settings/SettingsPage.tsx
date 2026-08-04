import { redirect, useLoaderData } from 'react-router'
import { UnsavedChangesModal } from '@/shared/ui'
import { useUnsavedChangesGuard } from '@/shared/hooks'
import { canManageSettings, ensureAuthReady, getAuthState } from '@/shared/auth'
import { getAllSiteSettings } from '@/features/admin/api/adminSiteSettings'
import { useSettingsForm } from './hooks/useSettingsForm'
import { SettingsForm } from './components/SettingsForm'

/**
 * Loads the whole settings catalog. Errors are NOT swallowed — a rejection propagates to
 * `AdminErrorBoundary`, exactly like `productsLoader`.
 *
 * Admin-only (`SiteSettingsController` is `[Authorize(Roles = "Admin")]`); a TourManager who types
 * the URL is sent back to the dashboard rather than shown a raw 403.
 */
export async function settingsLoader() {
  await ensureAuthReady()
  if (!canManageSettings(getAuthState().user?.role)) throw redirect('/admin')

  const settings = await getAllSiteSettings()
  return { settings }
}

/**
 * Container of the settings screen: it owns the form state (through `useSettingsForm`) and the
 * unsaved-changes guard, and hands everything else to presentational components.
 *
 * State is seeded from the loader once, via the hook's lazy initializer, and lives locally
 * afterwards — saving replaces it with the server's own response, so the loader is never
 * revalidated.
 */
export function SettingsPage() {
  const { settings } = useLoaderData<typeof settingsLoader>()
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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-neutral-900">Настройки</h1>
        <p className="text-sm text-neutral-500">
          Содержимое главного экрана, контакты, соцсети, логотип и SEO публичного сайта.
        </p>
      </header>

      {isEmpty ? (
        <div className="rounded-xl border border-neutral-200 bg-white px-6 py-14 text-center">
          <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
            <span aria-hidden="true" className="mb-2 text-2xl">
              ⚙
            </span>
            <h2 className="text-base font-semibold text-neutral-800">Настроек пока нет</h2>
            <p className="text-sm text-neutral-500">
              Сервер не вернул ни одной настройки. Обновите страницу — если ничего не изменилось,
              обратитесь к разработчику.
            </p>
          </div>
        </div>
      ) : (
        <SettingsForm
          state={state}
          actions={actions}
          validation={validation}
          dirtyCount={dirtyCount}
          canSubmit={canSubmit}
          hasAttemptedSubmit={hasAttemptedSubmit}
          isSubmitting={isSubmitting}
          error={error}
          savedAt={savedAt}
          onSubmit={submit}
        />
      )}

      <UnsavedChangesModal open={guard.isBlocking} onCancel={guard.cancel} onConfirm={guard.confirm} />
    </div>
  )
}
