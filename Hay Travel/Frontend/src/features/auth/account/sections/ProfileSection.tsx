import { useEffect, useState } from 'react'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import {
  authErrorMessageKey,
  resendVerificationRequest,
  type AuthUser,
  type UserInfoModel,
} from '@/shared/auth'
import { Spinner } from '@/shared/ui'
import { AlertIcon } from '@/shared/ui/icons'
import { AuthError, AuthSuccess } from '../../components/AuthShell'
import { ProfileSummary } from '../components/ProfileSummary'

/** Mirrors `AuthService.ResendVerificationCooldownSeconds`, exactly as `CheckEmailPage` does. The
 * server swallows an early call silently (a generic 200, no letter), so this countdown exists only
 * so the button stops inviting presses that would do nothing. */
const RESEND_COOLDOWN_SECONDS = 60

interface ProfileSectionProps {
  /** Rebuilt from the token on a cold reload, so it is always present. */
  user: AuthUser
  /** `GET api/Account/Me`, or `null` when that request failed — see `accountLoader`. */
  profile: UserInfoModel | null
  /** Where the confirmation letter goes. Resolved by the page (profile first, token second) so
   * this section does not repeat that precedence rule. */
  email: string
}

/**
 * «Профиль» — the entry room of the cabinet: who you are, plus the one thing here that can require
 * an action.
 *
 * The account rows themselves are read-only by product decision (A6) and stay in `ProfileSummary`.
 * What is new is the unverified-email warning ABOVE the card: today that state is a red line inside
 * the list, and a red line with no button next to it solves nothing — the visitor is told there is
 * a problem and given no way to act on it. The row stays where it is as well: the card is a full
 * snapshot of the account, and cutting one line out of it because it is also mentioned above would
 * make the list incomplete.
 */
export function ProfileSection({ user, profile, email }: ProfileSectionProps) {
  const { t } = useLocale()

  const isVerified = profile?.isEmailVerified ?? user.isEmailVerified

  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /* The DEADLINE, not a tick count: background tabs get their timers throttled, and a counter that
     merely decrements would drift behind the window the server actually enforces. Starts at `null`
     because, unlike `/auth/check-email`, arriving here did not send anything. */
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    if (cooldownUntil === null) return

    function tick() {
      setSecondsLeft(Math.max(0, Math.ceil(((cooldownUntil ?? 0) - Date.now()) / 1000)))
    }

    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [cooldownUntil])

  async function handleResend() {
    setError(null)
    setSent(false)
    setIsSending(true)
    try {
      await resendVerificationRequest(email)
      setSent(true)
      setCooldownUntil(Date.now() + RESEND_COOLDOWN_SECONDS * 1000)
      setSecondsLeft(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      // Only a network/unexpected failure reaches this branch: the endpoint answers 200 for every
      // domain outcome so it cannot become an account-existence oracle.
      setError(t(authErrorMessageKey(err)))
    } finally {
      setIsSending(false)
    }
  }

  const isCoolingDown = secondsLeft > 0

  return (
    <div className="flex flex-col gap-4">
      <h2 className="card-title text-ink">{t('account.sectionProfile')}</h2>

      {!isVerified && (
        /* `flex-wrap` + a text basis wide enough to crowd out the button is what moves the action
           under the message on a phone and keeps it on the right on a desktop — one button, one
           icon, no `sm:hidden` twin of either. */
        <div className="flex flex-wrap items-start gap-x-2.5 gap-y-3 rounded-xl bg-warning-soft px-3.5 py-3 text-sm text-warning ring-1 ring-warning/40">
          <AlertIcon size={17} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1 basis-64">
            <p className="font-semibold">{t('account.emailUnverifiedTitle')}</p>
            <p className="mt-0.5 break-words opacity-90">
              {t('account.emailUnverifiedBody', { email })}
            </p>
          </div>

          <button
            type="button"
            onClick={handleResend}
            disabled={isSending || isCoolingDown}
            aria-busy={isSending || undefined}
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-2 text-sm text-ink-dim ring-1 ring-edge-strong transition-colors hover:text-gold-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:text-ink-dim"
          >
            {isSending && <Spinner size="sm" />}
            {isSending
              ? t('auth.submitting')
              : isCoolingDown
                ? t('auth.resendCooldown', { seconds: secondsLeft })
                : t('account.emailVerifySend')}
          </button>
        </div>
      )}

      {error && <AuthError message={error} />}
      {sent && !error && <AuthSuccess message={t('auth.resendSent')} />}

      <div className="rounded-2xl bg-panel p-4 ring-1 ring-edge sm:p-5">
        <ProfileSummary user={user} profile={profile} />
      </div>
    </div>
  )
}
