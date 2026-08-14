import { useState } from 'react'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { authErrorMessageKey, clearForceChangePassword } from '@/shared/auth'
import { changePassword } from '../../api/changePassword'
import { AuthField } from '../../components/AuthField'
import { AuthError, AuthNotice, AuthSubmitButton } from '../../components/AuthShell'
import { MAX_PASSWORD_LENGTH, validateConfirm, validatePassword } from '../../lib/passwordRules'

type FieldErrors = Partial<Record<'newPassword' | 'confirmPassword', string>>

interface PasswordChangeFormProps {
  /**
   * Fired after the password has actually changed. `/auth/change-password` uses it to continue to
   * `?returnTo=` when the visitor was sent there by the forced-change redirect; `/account` does not
   * pass it at all — someone who opened the section deliberately should see the confirmation, not
   * be navigated away from it.
   */
  onSuccess?: () => void
  /** `false` inside an accordion section that the visitor just opened deliberately — stealing focus
   * there is fine, but the dedicated page wants it and the section does not fight for it. */
  autoFocus?: boolean
}

/**
 * `POST api/Auth/ChangePassword`, as a form that two screens embed: the standalone
 * `/auth/change-password` page (which is also the forced-change destination) and the «Пароль»
 * section of `/account`.
 *
 * Lifted out of `ChangePasswordPage` unchanged in behaviour — the page kept the guard, the shell and
 * the forced-change notice; everything the FORM does (validation, the request, the success state)
 * moved here so the two hosts cannot drift.
 *
 * `clearForceChangePassword()` is called here rather than by the hosts: whichever screen the change
 * happened on, the flag is now stale, and `adminRootLoader` would otherwise keep bouncing the user
 * back to the change screen.
 */
export function PasswordChangeForm({ onSuccess, autoFocus = false }: PasswordChangeFormProps) {
  const { t } = useLocale()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const currentPassword = String(data.get('currentPassword') ?? '')
    const newPassword = String(data.get('newPassword') ?? '')
    const confirmPassword = String(data.get('confirmPassword') ?? '')

    const lengthProblem = validatePassword(newPassword)
    const matchProblem = validateConfirm(newPassword, confirmPassword)
    if (lengthProblem || matchProblem) {
      setFieldErrors({
        newPassword: lengthProblem ? t(lengthProblem.key, lengthProblem.vars) : undefined,
        confirmPassword: matchProblem ? t(matchProblem.key, matchProblem.vars) : undefined,
      })
      return
    }

    setFieldErrors({})
    setError(null)
    setIsSubmitting(true)
    try {
      await changePassword({ currentPassword, newPassword })
      clearForceChangePassword()
      setDone(true)
      onSuccess?.()
    } catch (err) {
      setError(t(authErrorMessageKey(err)))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (done) return <AuthNotice message={t('auth.changeSuccess')} />

  return (
    <form className="flex flex-col gap-3.5" onSubmit={handleSubmit} noValidate>
      {error && <AuthError message={error} />}
      <AuthField
        name="currentPassword"
        label={t('auth.currentPassword')}
        type="password"
        autoComplete="current-password"
        maxLength={MAX_PASSWORD_LENGTH}
        autoFocus={autoFocus}
      />
      <AuthField
        name="newPassword"
        label={t('auth.newPassword')}
        type="password"
        autoComplete="new-password"
        maxLength={MAX_PASSWORD_LENGTH}
        error={fieldErrors.newPassword}
      />
      <AuthField
        name="confirmPassword"
        label={t('auth.confirmPassword')}
        type="password"
        autoComplete="new-password"
        maxLength={MAX_PASSWORD_LENGTH}
        error={fieldErrors.confirmPassword}
      />
      <AuthSubmitButton disabled={isSubmitting}>
        {isSubmitting ? t('auth.submitting') : t('auth.changeSubmit')}
      </AuthSubmitButton>
    </form>
  )
}
