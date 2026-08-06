import { Link } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import type { LoginRequest } from '@/shared/auth'
import { LockIcon, UserIcon } from '@/shared/ui/icons'
import { AuthField } from './AuthField'
import { AuthError, AuthSubmitButton } from './AuthShell'

interface LoginFormProps {
  onSubmit: (request: LoginRequest) => void
  /** Already-translated, form-level failure (bad credentials, locked, unverified…). */
  error: string | null
  isSubmitting: boolean
  /** Carried onto the "forgot password" link so the visitor returns here afterwards. */
  forgotPasswordHref: string
}

/**
 * Presentational sign-in form. Owns no state: values are read from the DOM at submit
 * (see `AuthField`), everything else comes from `AuthPage`.
 *
 * One field for both identifiers — the backend's `UsernameOrEmail` accepts either, so asking the
 * visitor to remember which they signed up with would be a needless obstacle.
 */
export function LoginForm({ onSubmit, error, isSubmitting, forgotPasswordHref }: LoginFormProps) {
  const { t } = useLocale()

  return (
    <form
      className="mt-5 space-y-3.5"
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        onSubmit({
          usernameOrEmail: String(data.get('usernameOrEmail') ?? '').trim(),
          password: String(data.get('password') ?? ''),
        })
      }}
    >
      {error && <AuthError message={error} />}

      <AuthField
        name="usernameOrEmail"
        label={t('auth.usernameOrEmail')}
        type="text"
        autoComplete="username"
        maxLength={256}
        icon={<UserIcon size={16} />}
      />
      <AuthField
        name="password"
        label={t('auth.password')}
        type="password"
        autoComplete="current-password"
        maxLength={128}
        icon={<LockIcon size={16} />}
      />

      <div className="text-right">
        <Link
          to={forgotPasswordHref}
          className="text-xs text-gold-ink transition-colors hover:text-accent-strong"
        >
          {t('auth.forgotPassword')}
        </Link>
      </div>

      <AuthSubmitButton disabled={isSubmitting}>
        {isSubmitting ? t('auth.submitting') : t('auth.submitLogin')}
      </AuthSubmitButton>
    </form>
  )
}
