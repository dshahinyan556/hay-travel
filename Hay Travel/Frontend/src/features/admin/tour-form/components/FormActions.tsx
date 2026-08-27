import { Link } from 'react-router'
import { Button, Spinner, buttonClassName } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { tourFormCopy } from '@/features/admin/tour-form/lib/tourFormCopy'

interface FormActionsProps {
  isSubmitting: boolean
  isValid: boolean
  /** True once the user has tried to save at least once — gates the red "fix the form" note. */
  hasAttemptedSubmit: boolean
  /** Submit-time server error, shown as a note; null when there is none. */
  submitError: string | null
  onSubmit: () => void
}

/**
 * Sticky action bar pinned to the bottom of the form. "Сохранить" stays clickable even while
 * the form is invalid (only submitting disables it) — `onSubmit` itself no-ops on an invalid
 * form and reveals the field errors instead, so a disabled button never blocks the admin from
 * finding out *why* saving didn't happen. "Отмена" returns to the products list. The note area
 * explains why saving is blocked, or surfaces the submit error; before the first attempt it
 * stays neutral even if required fields are still empty.
 */
export function FormActions({
  isSubmitting,
  isValid,
  hasAttemptedSubmit,
  submitError,
  onSubmit,
}: FormActionsProps) {
  const copy = useCopy(tourFormCopy).actions
  const showInvalidWarning = hasAttemptedSubmit && !isValid
  const note = submitError ? submitError : showInvalidWarning ? copy.invalidNote : copy.draftNote
  const isError = Boolean(submitError) || showInvalidWarning

  return (
    <div className="sticky bottom-0 z-10 -mx-4 -mb-5 flex flex-wrap items-center gap-3 border-t border-neutral-200 bg-white px-4 py-3.5 shadow-[0_-6px_18px_rgba(15,23,42,0.06)] sm:-mx-6 sm:-mb-6 sm:px-6">
      <p className={`mr-auto text-xs ${isError ? 'font-semibold text-rose-700' : 'text-neutral-500'}`}>
        {note}
      </p>
      <Link to="/admin/products" className={buttonClassName('ghost', 'md')}>
        {copy.cancel}
      </Link>
      <Button type="button" onClick={onSubmit} disabled={isSubmitting} className="min-w-32">
        {isSubmitting ? (
          <span className="inline-flex items-center gap-2">
            <Spinner size="sm" />
            {copy.saving}
          </span>
        ) : (
          copy.save
        )}
      </Button>
    </div>
  )
}
