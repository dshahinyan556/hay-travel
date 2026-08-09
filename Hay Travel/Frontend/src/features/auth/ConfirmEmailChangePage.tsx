import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { logout } from '@/shared/auth'
import { confirmEmailChange } from './account/api/emailChange'
import { accountErrorMessageKey } from './account/lib/accountErrors'
import { AuthShell, AuthError, AuthNotice } from './components/AuthShell'

type Status = 'pending' | 'success' | 'error'

/**
 * `/auth/confirm-email-change?token=…` — step 4 of the email change, opened from the NEW mailbox.
 *
 * Structurally a copy of `VerifyEmailPage`, and for the same two reasons, both of which would
 * silently burn a ONE-TIME token:
 *
 *  1. NOT a route `loader`. Loaders re-run on revalidation, and the second run would hit an
 *     already-spent token and report failure to someone who actually succeeded.
 *  2. The effect is latched by a `useRef` set SYNCHRONOUSLY before the first `await`. StrictMode
 *     deliberately mounts, unmounts and remounts effects in development; without the latch the POST
 *     fires twice and the second one fails.
 *
 * ── Why it signs you out ──────────────────────────────────────────────────────────────────────
 * `AuthUser.email` comes from the access token's `email` claim after a cold load, and a silent
 * refresh keeps the existing user object rather than re-reading it (see `authStore`). So without a
 * sign-out the OLD address would keep showing in the header and on `/account` until the tab is
 * closed — while the account is already owned by the new one. Signing out is also the honest
 * answer: the credential that identifies this account has just changed (ADR 010, decision 4).
 *
 * `logout()` failing does not fail the page: it clears local state in `finally` regardless, and the
 * email change itself already succeeded.
 */
export function ConfirmEmailChangePage() {
  const { t } = useLocale()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [status, setStatus] = useState<Status>('pending')
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    if (!token) {
      setStatus('error')
      setError(t('account.error.linkInvalid'))
      return
    }

    let cancelled = false
    confirmEmailChange(token)
      .then(() => logout().catch(() => undefined))
      .then(() => {
        if (!cancelled) setStatus('success')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setStatus('error')
        setError(t(accountErrorMessageKey(err)))
      })

    return () => {
      cancelled = true
    }
    // Runs once for the token in the URL; `t` is deliberately not a dependency — switching language
    // mid-request must not re-fire the one-time POST (the latch would block it anyway).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <AuthShell title={t('account.confirmTitle')}>
      <div className="flex flex-col gap-4">
        {status === 'pending' && <AuthNotice message={t('account.confirmPending')} />}
        {status === 'success' && <AuthNotice message={t('account.confirmSuccess')} />}
        {status === 'error' && error && <AuthError message={error} />}

        {status !== 'pending' && (
          <Link
            to="/auth"
            className="w-full rounded-full bg-gold-fill px-5 py-3 text-center text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none"
          >
            {t('auth.verifyAction')}
          </Link>
        )}
      </div>
    </AuthShell>
  )
}
