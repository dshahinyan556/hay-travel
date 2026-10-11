import { AdminToolbar } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { formatSavedAt, settingsCopy } from '@/features/admin/settings/lib/settingsCopy'

interface SettingsActionsProps {
  /** How many settings differ from the last saved state. */
  dirtyCount: number
  /** False while saving or while nothing changed (the hook's `canSubmit`). */
  canSubmit: boolean
  /** `settings.Update` — without it Save stays visible but disabled, with a tooltip. */
  canUpdate: boolean
  isSubmitting: boolean
  savedAt: Date | null
  onSubmit: () => void
  onCancel: () => void
}

/**
 * CONTENT of the pinned control zone (`SetupFormLayout.controlZone`) — `AdminToolbar` with
 * Отмена/Сохранить plus one note next to it: "N несохранённых изменений" while anything is dirty,
 * «Сохранено в HH:MM» right after a save. One button, one contract — "changed anything, pressed
 * once, saved"; per-section buttons would leave the admin guessing which half was stored.
 *
 * Moved from the bottom-pinned `footer` bar to the top (решение Давида 2026-10-11, шаблон как у
 * заказа). The save error and the "fix the form" warning are not here any more — they belong to
 * the layout's `message` slot (`SettingsPage`), like on every other screen.
 *
 * "Сохранить" stays clickable even on an invalid form — `onSubmit` itself no-ops and reveals the
 * field errors instead, so a disabled button never hides *why* saving didn't happen.
 */
export function SettingsActions({
  dirtyCount,
  canSubmit,
  canUpdate,
  isSubmitting,
  savedAt,
  onSubmit,
  onCancel,
}: SettingsActionsProps) {
  const copy = useCopy(settingsCopy)
  const { locale } = useLocale()

  const note =
    dirtyCount > 0
      ? copy.unsavedChanges(dirtyCount)
      : savedAt
        ? copy.savedAt(formatSavedAt(locale, savedAt))
        : null

  return (
    <>
      <AdminToolbar
        onCancel={onCancel}
        onSave={onSubmit}
        cancelState={{ disabled: dirtyCount === 0 || isSubmitting }}
        saveState={{
          disabled: !canSubmit || !canUpdate,
          pending: isSubmitting,
          hint: canUpdate ? null : copy.noPermissionHint,
        }}
      />
      {note && <p className="text-xs text-neutral-500">{note}</p>}
    </>
  )
}
