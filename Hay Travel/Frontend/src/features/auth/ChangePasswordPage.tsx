import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { authErrorMessageKey, clearForceChangePassword, useAuth } from '@/shared/auth'
import { changePassword } from './api/changePassword'
import { AuthField } from './components/AuthField'
import { AuthShell, AuthError, AuthNotice, AuthSubmitButton } from './components/AuthShell'
import { MAX_PASSWORD_LENGTH, validateConfirm, validatePassword } from './lib/passwordRules'
import { readReturnTo, withReturnTo } from './lib/returnTo'

type FieldErrors = Partial<Record<'newPassword' | 'confirmPassword', string>>

/**
 * `/auth/change-password` — change your own password while signed in.
 *
 * Also the destination of the forced-change redirect (`forceChangePassword` on the login
 * response, re-checked by `adminRootLoader`), which is why it shows a notice explaining why the
 * user landed here and why it honours `?returnTo=`: after the change, they continue where they
 * were headed.
 *
 * Guarded client-side by an effect rather than a loader, because it is a plain page under
 * `RootLayout` with no loader of its own; an anonymous visitor is sent to `/auth` to sign in
 * first. The endpoint is `[Authorize]` regardless.
 */
export function ChangePasswordPage() {
  const { t } = useLocale()
  const navigate = useNavigate()
  const location = useLocation()
  const { status, user, forceChangePassword } = useAuth()
  const returnTo = readReturnTo(location.search)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  // `status` is 'idle'/'loading' during a cold reload — waiting for it avoids bouncing a signed-in
  // user out on F5 just because the session hadn't been restored yet.
  const isResolved = status === 'authenticated' || status === 'anonymous'

  useEffect(() => {
    if (isResolved && !user) {
      navigate(withReturnTo('/auth', `${location.pathname}${location.search}`), { replace: true })
    }
  }, [isResolved, user, navigate, location.pathname, location.search])

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
      // Only auto-forward when the user was sent here against their will; someone who came from
      // their account panel should see the confirmation, not be bounced away from it.
      if (forceChangePassword) navigate(returnTo, { replace: true })
    } catch (err) {
      setError(t(authErrorMessageKey(err)))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!user) return null

  return (
    <AuthShell title={t('auth.changePasswordTitle')} subtitle={user.email}>
      <div className="flex flex-col gap-3.5">
        {forceChangePassword && !done && <AuthNotice message={t('auth.forceChangeNotice')} />}
        {done && <AuthNotice message={t('auth.changeSuccess')} />}

        {!done && (
          <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
            {error && <AuthError message={error} />}
            <AuthField
              name="currentPassword"
              label={t('auth.currentPassword')}
              type="password"
              autoComplete="current-password"
              maxLength={MAX_PASSWORD_LENGTH}
              autoFocus
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
        )}
      </div>
    </AuthShell>
  )
}
