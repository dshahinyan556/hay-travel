import { Button, Spinner } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import type { Locale } from '@/shared/lib/locale'
import { formatSavedAt, settingsCopy } from '@/features/admin/settings/lib/settingsCopy'
import type { SettingsCopy } from '@/features/admin/settings/lib/settingsCopy'

interface SettingsActionsProps {
  /** How many settings differ from the last saved state. */
  dirtyCount: number
  /** True only when nothing blocks saving (D4-1: both languages filled on every translatable key). */
  isValid: boolean
  /** True once the admin has tried to save at least once — gates the red "fix the form" note. */
  hasAttemptedSubmit: boolean
  canSubmit: boolean
  isSubmitting: boolean
  error: string | null
  savedAt: Date | null
  onSubmit: () => void
}

/**
 * CONTENT of the pinned save bar — the note on the left, a single "Сохранить" on the right: one
 * button, one contract, "changed anything, pressed once, saved". Per-section buttons would leave
 * the admin guessing which half of their edits was actually stored.
 *
 * The bar's own chrome (card, border, `sticky bottom-0`, shadow) is NOT here any more: since the
 * template-C retrofit this renders into `SetupFormLayout`'s `footer` slot, which owns the position
 * and the frame so both screens of that archetype cannot drift apart. This component returns a
 * fragment and stays purely about what the bar SAYS.
 *
 * `FormActions` from the tour form is not reused (hard-codes a "Отмена → /admin/products" link
 * and draft-of-a-tour copy), but the submit/validation contract mirrors it: "Сохранить" stays
 * clickable even on an invalid form — `onSubmit` itself no-ops and reveals the field errors
 * instead, so a disabled button never hides *why* saving didn't happen.
 */
export function SettingsActions({
  dirtyCount,
  isValid,
  hasAttemptedSubmit,
  canSubmit,
  isSubmitting,
  error,
  savedAt,
  onSubmit,
}: SettingsActionsProps) {
  const copy = useCopy(settingsCopy)
  const { locale } = useLocale()
  const showInvalidWarning = hasAttemptedSubmit && !isValid
  const note = noteFor({ copy, locale, dirtyCount, showInvalidWarning, error, savedAt })
  const isError = Boolean(error) || showInvalidWarning

  return (
    <>
      <p
        className={`mr-auto text-xs ${isError ? 'font-semibold text-rose-700' : 'text-neutral-500'}`}
        role={error ? 'alert' : undefined}
      >
        {note}
      </p>
      <Button type="button" onClick={onSubmit} disabled={!canSubmit} className="min-w-32">
        {isSubmitting ? (
          <span className="inline-flex items-center gap-2">
            <Spinner size="sm" />
            {copy.saving}
          </span>
        ) : (
          copy.save
        )}
      </Button>
    </>
  )
}

interface NoteInput {
  copy: SettingsCopy
  locale: Locale
  dirtyCount: number
  showInvalidWarning: boolean
  error: string | null
  savedAt: Date | null
}

function noteFor({
  copy,
  locale,
  dirtyCount,
  showInvalidWarning,
  error,
  savedAt,
}: NoteInput): string {
  if (error) return error
  if (showInvalidWarning) return copy.invalidForm
  if (dirtyCount === 0) {
    if (!savedAt) return ''
    return copy.savedAt(formatSavedAt(locale, savedAt))
  }
  return copy.changedFields(dirtyCount)
}
