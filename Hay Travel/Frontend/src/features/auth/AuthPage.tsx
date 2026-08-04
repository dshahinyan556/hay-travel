import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import {
  authErrorMessageKey,
  login,
  logout,
  register,
  useAuth,
  type LoginRequest,
  type RegisterRequest,
} from '@/shared/auth'
import { AuthShell } from './components/AuthShell'
import { LoginForm } from './components/LoginForm'
import { RegisterForm } from './components/RegisterForm'
import { AccountPanel } from './components/AccountPanel'
import { readReturnTo, withReturnTo } from './lib/returnTo'

type Mode = 'login' | 'register'

/**
 * `/auth` — the container for signing in and signing up.
 *
 * Three states in one route rather than three URLs:
 *  - signed in → `AccountPanel` (bouncing a signed-in visitor away from a page they navigated to
 *    would just look broken; and this is where the header's user menu points);
 *  - `login` / `register` tabs otherwise.
 *
 * `?returnTo=` is honoured on successful sign-in (sanitised in `lib/returnTo` — it is
 * attacker-controllable). Registration does NOT sign anyone in: the account is unverified until
 * the emailed link is used, so it hands off to `/auth/check-email` with the address and, in dev,
 * the token the backend echoed back.
 */
export function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const { t } = useLocale()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

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

  async function handleLogout() {
    setIsLoggingOut(true)
    try {
      await logout()
    } finally {
      setIsLoggingOut(false)
    }
  }

  if (user) {
    return (
      <AuthShell title={t('auth.accountTitle')} subtitle={user.email}>
        <AccountPanel user={user} onLogout={handleLogout} isLoggingOut={isLoggingOut} />
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title={isRegister ? t('auth.createAccount') : t('auth.welcomeBack')}
      subtitle={isRegister ? t('auth.subtitleRegister') : t('auth.subtitleLogin')}
      note={isRegister ? t('auth.terms') : undefined}
    >
      <div className="flex rounded-full p-0.5 ring-1 ring-edge">
        {(['login', 'register'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setMode(value)
              setError(null)
            }}
            aria-pressed={mode === value}
            className={[
              'flex-1 rounded-full px-4 py-2 text-sm transition-colors',
              mode === value ? 'bg-wine text-gold-light' : 'text-ink-dim hover:text-gold-ink',
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
