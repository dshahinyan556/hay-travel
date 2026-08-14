import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { authErrorMessageKey, forgotPasswordRequest } from '@/shared/auth'
import { AuthField } from './components/AuthField'
import { AuthShell, AuthError, AuthNotice, AuthSubmitButton } from './components/AuthShell'
import { readReturnTo, withReturnTo } from '@/shared/lib/returnTo'

/**
 * `/auth/forgot-password` — request a password-reset link.
 *
 * The success state is intentionally identical whether or not the address exists: the endpoint
 * always answers 200 so it cannot be used to enumerate accounts, and showing "no such user" here
 * would give away exactly what the backend refuses to.
 *
 * The `devToken` echo (development only, no mail provider configured) is surfaced as a direct
 * link so the flow is testable locally without an inbox.
 */
export function ForgotPasswordPage() {
  const { t } = useLocale()
  const location = useLocation()
  const returnTo = readReturnTo(location.search)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [devToken, setDevToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim()

    setError(null)
    setIsSubmitting(true)
    try {
      const result = await forgotPasswordRequest({ email })
      setDevToken(result.devToken ?? null)
      setSent(true)
    } catch (err) {
      setError(t(authErrorMessageKey(err)))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (sent) {
    return (
      <AuthShell title={t('auth.forgotTitle')}>
        <div className="flex flex-col gap-4">
          <AuthNotice message={t('auth.forgotSent')} />

          {devToken && (
            <div className="flex flex-col gap-2 rounded-xl bg-panel-raised px-3.5 py-3 ring-1 ring-edge-strong">
              <span className="text-xs text-ink-muted">{t('auth.devTokenHint')}</span>
              <Link
                to={`/auth/reset-password?token=${encodeURIComponent(devToken)}`}
                className="text-sm text-gold-ink underline-offset-4 transition-colors hover:text-accent-strong hover:underline"
              >
                {t('auth.resetTitle')}
              </Link>
            </div>
          )}

          <Link
            to={withReturnTo('/auth', returnTo)}
            className="w-full rounded-full px-5 py-3 text-center text-sm text-ink-dim ring-1 ring-edge-strong transition-colors hover:text-gold-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
          >
            {t('auth.verifyAction')}
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title={t('auth.forgotTitle')} subtitle={t('auth.forgotSubtitle')}>
      <form className="flex flex-col gap-3.5" onSubmit={handleSubmit} noValidate>
        {error && <AuthError message={error} />}
        <AuthField
          name="email"
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          maxLength={256}
          autoFocus
        />
        <AuthSubmitButton disabled={isSubmitting}>
          {isSubmitting ? t('auth.submitting') : t('auth.forgotSubmit')}
        </AuthSubmitButton>
      </form>
    </AuthShell>
  )
}
