import { useState } from 'react'
import { Link } from 'react-router'
import { MountainIcon } from '@/shared/ui/icons'

type Mode = 'login' | 'register'

/**
 * Login / registration — presentation only.
 *
 * There is no user role or auth endpoint yet (see `docs/client-site.md`). This is built so
 * wiring it up later is mechanical: one form, `mode` decides which fields show, and the submit
 * handler is the single place a real call has to land. Deliberately NOT storing anything —
 * a fake "logged in" state would spread through the app and have to be unpicked later.
 *
 * Inputs use `autoComplete` hints so password managers behave correctly from day one.
 */
export function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')
  const isRegister = mode === 'register'

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-16 sm:py-24">
      <div className="flex flex-col items-center text-center">
        <span className="text-gold-ink">
          <MountainIcon size={28} />
        </span>
        <h1 className="text-gold-sheen mt-3 font-display text-3xl">
          {isRegister ? 'Создать аккаунт' : 'С возвращением'}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {isRegister
            ? 'Сохраняйте избранные маршруты и следите за бронями.'
            : 'Войдите, чтобы видеть свои брони и избранное.'}
        </p>
      </div>

      <div className="mt-8 rounded-2xl bg-panel p-6 ring-1 ring-edge">
        <div className="flex rounded-full p-0.5 ring-1 ring-edge">
          {(['login', 'register'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              aria-pressed={mode === value}
              className={[
                'flex-1 rounded-full px-4 py-2 text-sm transition-colors',
                mode === value ? 'bg-wine text-gold-light' : 'text-ink-dim hover:text-gold-ink',
              ].join(' ')}
            >
              {value === 'login' ? 'Вход' : 'Регистрация'}
            </button>
          ))}
        </div>

        <form
          className="mt-5 space-y-3.5"
          onSubmit={(e) => {
            e.preventDefault()
            // Intentionally inert until the auth endpoint exists.
          }}
        >
          {isRegister && <AuthField label="Имя" type="text" autoComplete="name" />}
          <AuthField label="Email" type="email" autoComplete="email" />
          <AuthField
            label="Пароль"
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
          />

          {!isRegister && (
            <div className="text-right">
              <button type="button" className="text-xs text-gold-ink transition-colors hover:text-accent-strong">
                Забыли пароль?
              </button>
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-full bg-gold-fill px-5 py-3 text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none"
          >
            {isRegister ? 'Зарегистрироваться' : 'Войти'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-ink-muted">
          Продолжая, вы соглашаетесь с условиями сервиса.
        </p>
      </div>

      <Link
        to="/"
        className="mt-6 text-center text-sm text-ink-dim transition-colors hover:text-gold-ink"
      >
        Вернуться на главную
      </Link>
    </div>
  )
}

function AuthField({
  label,
  type,
  autoComplete,
}: {
  label: string
  type: string
  autoComplete: string
}) {
  return (
    <label className="block">
      <span className="text-xs text-ink-muted">{label}</span>
      <input
        type={type}
        required
        autoComplete={autoComplete}
        className="mt-1.5 w-full rounded-xl bg-panel-raised px-3.5 py-2.5 text-sm text-ink ring-1 ring-edge-strong transition-colors focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
      />
    </label>
  )
}
