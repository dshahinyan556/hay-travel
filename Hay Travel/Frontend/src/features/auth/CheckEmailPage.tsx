import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { authErrorMessageKey, resendVerificationRequest } from '@/shared/auth'
import { Spinner } from '@/shared/ui'
import { AuthError, AuthShell, AuthSuccess } from './components/AuthShell'

/** What `AuthPage` hands over after a successful registration. Absent on a direct visit. */
interface CheckEmailState {
  email?: string
  devToken?: string | null
}

/**
 * Mirrors the backend's own 60s window (`AuthService.ResendVerificationCooldownSeconds`). The
 * server enforces it silently — an early call is a generic 200 with no letter sent — so this
 * countdown is purely so the button doesn't invite clicks that would do nothing.
 */
const RESEND_COOLDOWN_SECONDS = 60

/**
 * `/auth/check-email` — the "we sent you a link" screen.
 *
 * The address (and, in development, the token itself) arrive through router state rather than the
 * URL: a verification token in a shareable/loggable URL on OUR side is pointless exposure, and the
 * email is nobody's business but the visitor's. A direct visit therefore has no state, which is
 * handled rather than assumed away — the copy just drops the address.
 *
 * With an address in hand the screen also offers a resend (2026-08-27). Without one there is
 * nothing to resend — a direct visit keeps exactly the behaviour it had before.
 */
export function CheckEmailPage() {
  const { t } = useLocale()
  const { state } = useLocation()
  const { email, devToken: initialDevToken } = (state ?? {}) as CheckEmailState

  // Local copy of the dev token: a successful resend ROTATES it server-side (one live token per
  // user + type, ADR 006), so keeping the one registration returned would leave a dead link on
  // screen in development.
  const [devToken, setDevToken] = useState<string | null>(initialDevToken ?? null)
  const [isSending, setIsSending] = useState(false)
  const [resent, setResent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The cooldown starts on arrival, not on the first click: getting here means registration just
  // sent a letter, and the backend would silently swallow a resend inside its own window anyway.
  // Storing the DEADLINE rather than counting ticks down keeps the number honest — background
  // tabs get their timers throttled, and a tick-based counter would drift behind the real window.
  const [cooldownUntil, setCooldownUntil] = useState(() => Date.now() + RESEND_COOLDOWN_SECONDS * 1000)
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS)

  useEffect(() => {
    if (!email) return

    function tick() {
      setSecondsLeft(Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)))
    }

    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [email, cooldownUntil])

  async function handleResend() {
    if (!email) return

    setError(null)
    setResent(false)
    setIsSending(true)
    try {
      const result = await resendVerificationRequest(email)
      if (result.devToken) setDevToken(result.devToken)
      setResent(true)
      setCooldownUntil(Date.now() + RESEND_COOLDOWN_SECONDS * 1000)
      setSecondsLeft(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      // Only a network/unexpected failure can land here: the endpoint answers 200 for every
      // domain outcome, precisely so the screen cannot become an account-existence oracle.
      setError(t(authErrorMessageKey(err)))
    } finally {
      setIsSending(false)
    }
  }

  const isCoolingDown = secondsLeft > 0

  return (
    <AuthShell title={t('auth.checkEmailTitle')}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-dim">
          {t('auth.checkEmailBody', { email: email ?? t('auth.yourEmail') })}
        </p>

        {error && <AuthError message={error} />}
        {resent && !error && <AuthSuccess message={t('auth.resendSent')} />}

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

        {/* Same outline pill as the «Войти» link below on purpose: neither is THE action of this
            screen — the real one is in the visitor's inbox, and two competing gold buttons would
            claim otherwise. */}
        {email && (
          <button
            type="button"
            onClick={handleResend}
            disabled={isSending || isCoolingDown}
            aria-busy={isSending || undefined}
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-full px-5 py-3 text-center text-sm text-ink-dim ring-1 ring-edge-strong transition-colors hover:text-gold-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:text-ink-dim"
          >
            {isSending && <Spinner size="sm" />}
            {isSending
              ? t('auth.submitting')
              : isCoolingDown
                ? t('auth.resendCooldown', { seconds: secondsLeft })
                : t('auth.resendAction')}
          </button>
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
