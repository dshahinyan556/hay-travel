import { Link, useLocation } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { AuthShell } from './components/AuthShell'

/** What `AuthPage` hands over after a successful registration. Absent on a direct visit. */
interface CheckEmailState {
  email?: string
  devToken?: string | null
}

/**
 * `/auth/check-email` — the "we sent you a link" screen.
 *
 * The address (and, in development, the token itself) arrive through router state rather than the
 * URL: a verification token in a shareable/loggable URL on OUR side is pointless exposure, and the
 * email is nobody's business but the visitor's. A direct visit therefore has no state, which is
 * handled rather than assumed away — the copy just drops the address.
 */
export function CheckEmailPage() {
  const { t } = useLocale()
  const { state } = useLocation()
  const { email, devToken } = (state ?? {}) as CheckEmailState

  return (
    <AuthShell title={t('auth.checkEmailTitle')}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-dim">
          {t('auth.checkEmailBody', { email: email ?? t('auth.yourEmail') })}
        </p>

        {/* Only ever present with `DevEmailSender` (no SendGrid key configured): the backend
            returns the token in the response because no mail is actually sent. In production
            `devToken` is always null, so this block never renders. */}
        {devToken && (
          <div className="flex flex-col gap-2 rounded-xl bg-panel-raised px-3.5 py-3 ring-1 ring-edge-strong">
            <span className="text-xs text-ink-muted">{t('auth.devTokenHint')}</span>
            <Link
              to={`/auth/verify?token=${encodeURIComponent(devToken)}`}
              className="text-sm text-gold-ink underline-offset-4 transition-colors hover:text-accent-strong hover:underline"
            >
              {t('auth.devTokenOpen')}
            </Link>
          </div>
        )}

        <Link
          to="/auth"
          className="w-full rounded-full px-5 py-3 text-center text-sm text-ink-dim ring-1 ring-edge-strong transition-colors hover:text-gold-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
        >
          {t('auth.verifyAction')}
        </Link>
      </div>
    </AuthShell>
  )
}
