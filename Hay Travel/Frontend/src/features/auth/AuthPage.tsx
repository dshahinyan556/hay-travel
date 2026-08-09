import { useState } from 'react'
import { redirect, useLocation, useNavigate } from 'react-router'
import type { LoaderFunctionArgs } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import {
  authErrorMessageKey,
  ensureAuthReady,
  login,
  register,
  type LoginRequest,
  type RegisterRequest,
} from '@/shared/auth'
import { AuthShell } from './components/AuthShell'
import { LoginForm } from './components/LoginForm'
import { RegisterForm } from './components/RegisterForm'
import { readReturnTo, withReturnTo } from './lib/returnTo'

type Mode = 'login' | 'register'

/**
 * `/auth` is for signing IN. A visitor who already has a session is sent away (ADR 010, decision 3)
 * — the account screen is now its own route, and rendering login tabs to someone already signed in
 * was the confusing alternative this replaces.
 *
 * The destination is NOT always `/account`: a valid `?returnTo=` wins. Someone who followed a
 * "sign in to book this" link and turns out to be signed in already should land on the booking, not
 * in their profile. `readReturnTo` sanitises the value (it is attacker-controllable) and yields `/`
 * when there is nothing usable — which is the one case that falls through to `/account`.
 */
export async function authPageLoader({ request }: LoaderFunctionArgs) {
  const state = await ensureAuthReady()
  if (!state.user) return null

  const returnTo = readReturnTo(new URL(request.url).search)
  throw redirect(returnTo === '/' ? '/account' : returnTo)
}

/**
 * `/auth` — the container for signing in and signing up.
 *
 * `?returnTo=` is honoured on successful sign-in (sanitised in `lib/returnTo`). Registration does
 * NOT sign anyone in: the account is unverified until the emailed link is used, so it hands off to
 * `/auth/check-email` with the address and, in dev, the token the backend echoed back.
 */
export function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { t } = useLocale()
  const navigate = useNavigate()
  const location = useLocation()

  const returnTo = readReturnTo(location.search)
  const isRegister = mode === 'register'

  async function handleLogin(request: LoginRequest) {
    setError(null)
    setIsSubmitting(true)
    try {
      const state = await login(request)
      // A forced password change outranks the requested destination — but keep carrying it, so
      // the visitor still lands where they were going once the new password is set.
      navigate(
        state.forceChangePassword ? withReturnTo('/auth/change-password', returnTo) : returnTo,
        { replace: true },
      )
    } catch (err) {
      setError(t(authErrorMessageKey(err)))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRegister(request: RegisterRequest) {
    setError(null)
    setIsSubmitting(true)
    try {
      const result = await register(request)
      navigate('/auth/check-email', {
        replace: true,
        state: { email: request.email, devToken: result.devToken ?? null },
      })
    } catch (err) {
      setError(t(authErrorMessageKey(err)))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      title={isRegister ? t('auth.createAccount') : t('auth.welcomeBack')}
      subtitle={isRegister ? t('auth.subtitleRegister') : t('auth.subtitleLogin')}
      note={isRegister ? t('auth.terms') : undefined}
    >
      {/*
        Segmented control, same treatment as the filter toggles elsewhere in the app
        (`ProductsToolbar.ViewTab`, `TourTypeToggle`): colour cross-fade on the shared
        `--dur-micro`/`--ease-in-out-soft` tokens (index.css, "colour swap, toggles" — the same
        pair `shared/ui/Tabs` already uses) plus a `shadow-sm` elevation pop on the selected
        segment. Colour durations are NOT collapsed under `prefers-reduced-motion` (index.css
        ~250-260) — this is a tint, not travel, so nothing here needs its own reduced-motion
        branch.
      */}
      <div role="radiogroup" aria-label={t('auth.modeToggleLabel')} className="flex rounded-full p-0.5 ring-1 ring-edge">
        {(['login', 'register'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            onClick={() => {
              setMode(value)
              setError(null)
            }}
            aria-checked={mode === value}
            className={[
              // `transition-colors` alone leaves `shadow-sm` snapping in/out instantly while the
              // background fades — the mismatch is what reads as "not smooth". Listing `box-shadow`
              // explicitly alongside color puts both on the same fade.
              'flex-1 cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition-[color,background-color,box-shadow] duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)]',
              mode === value ? 'bg-wine text-gold-light shadow-sm' : 'text-ink-dim hover:text-gold-ink',
            ].join(' ')}
          >
            {value === 'login' ? t('auth.tabLogin') : t('auth.tabRegister')}
          </button>
        ))}
      </div>

      {isRegister ? (
        <RegisterForm onSubmit={handleRegister} error={error} isSubmitting={isSubmitting} />
      ) : (
        <LoginForm
          onSubmit={handleLogin}
          error={error}
          isSubmitting={isSubmitting}
          forgotPasswordHref={withReturnTo('/auth/forgot-password', returnTo)}
        />
      )}
    </AuthShell>
  )
}
