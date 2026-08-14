import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { authErrorMessageKey, resetPasswordRequest } from '@/shared/auth'
import { AuthField } from './components/AuthField'
import { AuthShell, AuthError, AuthNotice, AuthSubmitButton } from './components/AuthShell'
import { MAX_PASSWORD_LENGTH, validateConfirm, validatePassword } from './lib/passwordRules'

type FieldErrors = Partial<Record<'newPassword' | 'confirmPassword', string>>

/**
 * `/auth/reset-password?token=…` — set a new password from an emailed link.
 *
 * Unlike `/auth/verify` this can safely be a form: the token is only spent when the user submits,
 * so a prefetching mail client cannot burn it and there is no StrictMode double-fire to guard.
 * A successful reset revokes every refresh token of that account server-side, so any other
 * session is signed out — the user comes back through `/auth` like anyone else.
 */
export function ResetPasswordPage() {
  const { t } = useLocale()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
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
      await resetPasswordRequest({ token, newPassword })
      setDone(true)
    } catch (err) {
      setError(t(authErrorMessageKey(err)))
    } finally {
      setIsSubmitting(false)
    }
  }

  // A link without a token is a broken/truncated one — say so instead of showing a form that is
  // guaranteed to fail on submit.
  if (!token) {
    return (
      <AuthShell title={t('auth.resetTitle')}>
        <div className="flex flex-col gap-4">
          <AuthError message={t('auth.error.resetTokenInvalid')} />
          <BackToAuthLink label={t('auth.forgotTitle')} to="/auth/forgot-password" />
        </div>
      </AuthShell>
    )
  }

  if (done) {
    return (
      <AuthShell title={t('auth.resetTitle')}>
        <div className="flex flex-col gap-4">
          <AuthNotice message={t('auth.resetSuccess')} />
          <BackToAuthLink label={t('auth.verifyAction')} to="/auth" primary />
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title={t('auth.resetTitle')}>
      <form className="flex flex-col gap-3.5" onSubmit={handleSubmit} noValidate>
        {error && <AuthError message={error} />}
        <AuthField
          name="newPassword"
          label={t('auth.newPassword')}
          type="password"
          autoComplete="new-password"
          maxLength={MAX_PASSWORD_LENGTH}
          error={fieldErrors.newPassword}
          autoFocus
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
          {isSubmitting ? t('auth.submitting') : t('auth.resetSubmit')}
        </AuthSubmitButton>
      </form>
    </AuthShell>
  )
}

function BackToAuthLink({ label, to, primary }: { label: string; to: string; primary?: boolean }) {
  return (
    <Link
      to={to}
      className={
        primary
          ? 'w-full rounded-full bg-gold-fill px-5 py-3 text-center text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none'
          : 'w-full rounded-full px-5 py-3 text-center text-sm text-ink-dim ring-1 ring-edge-strong transition-colors hover:text-gold-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none'
      }
    >
      {label}
    </Link>
  )
}
