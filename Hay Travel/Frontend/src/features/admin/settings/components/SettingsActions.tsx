import { Button, Spinner } from '@/shared/ui'

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
 * Sticky action bar with a single "Сохранить" for the whole screen: one button, one contract —
 * "changed anything, pressed once, saved". Per-section buttons would leave the admin guessing
 * which half of their edits was actually stored.
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
  const showInvalidWarning = hasAttemptedSubmit && !isValid
  const note = noteFor({ dirtyCount, showInvalidWarning, error, savedAt })
  const isError = Boolean(error) || showInvalidWarning

  return (
    <div className="sticky bottom-0 z-10 -mx-4 -mb-5 flex flex-wrap items-center gap-3 border-t border-neutral-200 bg-white px-4 py-3.5 shadow-[0_-6px_18px_rgba(15,23,42,0.06)] sm:-mx-6 sm:-mb-6 sm:px-6">
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
            Сохранение…
          </span>
        ) : (
          'Сохранить'
        )}
      </Button>
    </div>
  )
}

interface NoteInput {
  dirtyCount: number
  showInvalidWarning: boolean
  error: string | null
  savedAt: Date | null
}

/** Russian plural of "поле" for the change counter. */
function fieldsLabel(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'поле'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'поля'
  return 'полей'
}

function noteFor({ dirtyCount, showInvalidWarning, error, savedAt }: NoteInput): string {
  if (error) return error
  if (showInvalidWarning) {
    return 'Проверьте форму: заполните оба языка у обязательных полей (отмечены *).'
  }
  if (dirtyCount === 0) {
    if (!savedAt) return ''
    const time = savedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    return `Сохранено в ${time}.`
  }
  return `Изменено ${dirtyCount} ${fieldsLabel(dirtyCount)}.`
}
