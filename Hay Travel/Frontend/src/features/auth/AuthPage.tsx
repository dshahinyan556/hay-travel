import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { redirect, useLocation, useNavigate } from 'react-router'
import type { LoaderFunctionArgs } from 'react-router'
import { useReducedMotion } from '@/shared/hooks'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import {
  authErrorMessageKey,
  ensureAuthReady,
  login,
  register,
  type LoginRequest,
  type RegisterRequest,
} from '@/shared/auth'
import { AuthSplitLayout } from './components/AuthSplitLayout'
import { AuthModeToggle, type AuthMode } from './components/AuthModeToggle'
import { LoginForm } from './components/LoginForm'
import { RegisterForm } from './components/RegisterForm'
import { readReturnTo, withReturnTo } from '@/shared/lib/returnTo'

/**
 * `'success'` exists only for sign-IN. Registration hands straight off to `/auth/check-email`,
 * which is already a confirmation screen — a second one in a row would be noise.
 */
type SubmitStatus = 'idle' | 'submitting' | 'success'

/** Пауза между «вход удался» и переходом. Не гейтится на `prefers-reduced-motion`: это пауза,
 *  а не движение — без неё человек не успевает понять, что вход прошёл, особенно если до этого
 *  он пару раз ошибся. */
const SUCCESS_HOLD_MS = 400

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
 * `?returnTo=` is honoured on successful sign-in (sanitised in `shared/lib/returnTo`). Registration
 * does NOT sign anyone in: the account is unverified until the emailed link is used, so it hands off
 * to `/auth/check-email` with the address and, in dev, the token the backend echoed back.
 */
export function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<SubmitStatus>('idle')

  const { t } = useLocale()
  const navigate = useNavigate()
  const location = useLocation()
  const reducedMotion = useReducedMotion()

  // Без этого размонтирование во время паузы «Вход выполнен» даёт `navigate` на снятом компоненте.
  const successTimer = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (successTimer.current !== null) clearTimeout(successTimer.current)
    },
    [],
  )

  const returnTo = readReturnTo(location.search)
  const isRegister = mode === 'register'

  async function handleLogin(request: LoginRequest) {
    setError(null)
    setStatus('submitting')
    try {
      const state = await login(request)
      setStatus('success')
      // A forced password change outranks the requested destination — but keep carrying it, so
      // the visitor still lands where they were going once the new password is set.
      const destination = state.forceChangePassword
        ? withReturnTo('/auth/change-password', returnTo)
        : returnTo
      successTimer.current = window.setTimeout(() => {
        navigate(destination, { replace: true })
      }, SUCCESS_HOLD_MS)
    } catch (err) {
      setError(t(authErrorMessageKey(err)))
      setStatus('idle')
    }
  }

  async function handleRegister(request: RegisterRequest) {
    setError(null)
    setStatus('submitting')
    try {
      const result = await register(request)
      navigate('/auth/check-email', {
        replace: true,
        state: { email: request.email, devToken: result.devToken ?? null },
      })
    } catch (err) {
      setError(t(authErrorMessageKey(err)))
      setStatus('idle')
    }
  }

  function handleModeChange(next: AuthMode) {
    setMode(next)
    setError(null)
  }

  return (
    <AuthSplitLayout
      title={isRegister ? t('auth.createAccount') : t('auth.welcomeBack')}
      subtitle={isRegister ? t('auth.subtitleRegister') : t('auth.subtitleLogin')}
      note={isRegister ? t('auth.terms') : undefined}
      isBusy={status === 'submitting'}
    >
      <AuthModeToggle value={mode} onChange={handleModeChange} disabled={status !== 'idle'} />
      {/*
        `layout` animates the card's height across the 2-field ↔ 7-field swap; without it the panel
        doubles in size in one frame and the page jerks. The literals `0.34` and `[0.22, 1, 0.36, 1]`
        ARE the `--dur-base` and `--ease-out-soft` tokens — framer cannot read CSS custom
        properties, so they are duplicated here on purpose. Keep them in sync with index.css.
      */}
      <motion.div
        layout
        transition={reducedMotion ? { duration: 0 } : { duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      >
        {isRegister ? (
          <RegisterForm onSubmit={handleRegister} error={error} status={status} />
        ) : (
          <LoginForm
            onSubmit={handleLogin}
            error={error}
            status={status}
            forgotPasswordHref={withReturnTo('/auth/forgot-password', returnTo)}
          />
        )}
      </motion.div>
    </AuthSplitLayout>
  )
}
