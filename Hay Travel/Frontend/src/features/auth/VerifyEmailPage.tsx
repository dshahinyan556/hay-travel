import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { authErrorMessageKey, verifyEmailRequest } from '@/shared/auth'
import { AuthShell, AuthError, AuthNotice } from './components/AuthShell'

type Status = 'pending' | 'success' | 'error'

/**
 * `/auth/verify?token=…` — consumes the emailed verification token.
 *
 * Two traps this deliberately avoids, both of which would silently eat the ONE-TIME token:
 *
 *  1. It is NOT a route `loader`. Loaders re-run on revalidation (any navigation back to this
 *     route, `revalidator.revalidate()`, …), and the second run would hit an already-spent token
 *     and report failure to a user who actually succeeded.
 *  2. The effect is guarded by a `useRef` set SYNCHRONOUSLY before the first `await`. React's
 *     StrictMode intentionally mounts, unmounts and remounts effects in development; a plain
 *     effect would fire the POST twice, and the second one would 400.
 *
 * `POST`, not a `GET` link: mail clients and link-preview crawlers prefetch `GET` URLs, which
 * would burn the token before the recipient ever clicked it.
 */
export function VerifyEmailPage() {
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
      setError(t('auth.error.verificationTokenInvalid'))
      return
    }

    let cancelled = false
    verifyEmailRequest({ token })
      .then(() => {
        if (!cancelled) setStatus('success')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setStatus('error')
        setError(t(authErrorMessageKey(err)))
      })

    return () => {
      cancelled = true
    }
    // Runs once for the token in the URL; `t` is not a dependency on purpose — switching language
    // mid-request must not re-fire the one-time POST (the ref would block it anyway).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <AuthShell title={t('auth.verifyTitle')}>
      <div className="flex flex-col gap-4">
        {status === 'pending' && <AuthNotice message={t('auth.verifyPending')} />}
        {status === 'success' && <AuthNotice message={t('auth.verifySuccess')} />}
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
