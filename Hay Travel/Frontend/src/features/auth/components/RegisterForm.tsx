import { useState } from 'react'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import type { RegisterRequest } from '@/shared/auth'
import { MailIcon, LockIcon, UserIcon, AtIcon } from '@/shared/ui/icons'
import {
  MAX_PASSWORD_LENGTH,
  MAX_USERNAME_LENGTH,
  validateConfirm,
  validatePassword,
  validateUsername,
} from '../lib/passwordRules'
import { useDefaultPhoneCountry } from '../hooks/useDefaultPhoneCountry'
import { AuthField } from './AuthField'
import { PhoneField } from './PhoneField'
import { AuthError, AuthSubmitButton } from './AuthShell'

interface RegisterFormProps {
  onSubmit: (request: RegisterRequest) => void
  error: string | null
  isSubmitting: boolean
}

/** Field-level messages, keyed by input name. */
type FieldErrors = Partial<Record<'username' | 'password' | 'confirmPassword', string>>

/**
 * Presentational sign-up form. Field set mirrors `RegisterModel` exactly — including `Username`,
 * which the backend requires (unique, min 3) and which the old presentation-only mock did not
 * have — plus one client-only field, `confirmPassword`: never sent to the server, only used to
 * catch a typo before submit. The phone field is the composite country-chip control (see
 * `PhoneField`, F2) — not required, digits-only, posts a hidden `phoneNumber` input the same way
 * the old plain field did.
 *
 * Local validation is limited to the rules that either have no server-side equivalent
 * (password/confirm match) or come back from the server as bodyless `ProblemDetails` with no
 * error code (username and password length) — everything else either has a real error code or is
 * covered by the inputs' own `type`/`required`.
 */
export function RegisterForm({ onSubmit, error, isSubmitting }: RegisterFormProps) {
  const { t } = useLocale()
  // Geo-IP guess for the country picker; resolves after the first render and only moves the
  // selection while the visitor has not touched the phone field (see `PhoneField`).
  const defaultCountry = useDefaultPhoneCountry()
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  // Shared by the password + confirm-password fields — one eye toggles both (F, 2026-08-06).
  const [passwordRevealed, setPasswordRevealed] = useState(false)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)

    const username = String(data.get('username') ?? '').trim()
    const password = String(data.get('password') ?? '')
    const confirmPassword = String(data.get('confirmPassword') ?? '')
    const lastName = String(data.get('lastName') ?? '').trim()

    const usernameProblem = validateUsername(username)
    const passwordProblem = validatePassword(password)
    const confirmProblem = passwordProblem ? null : validateConfirm(password, confirmPassword)
    if (usernameProblem || passwordProblem || confirmProblem) {
      setFieldErrors({
        username: usernameProblem ? t(usernameProblem.key, usernameProblem.vars) : undefined,
        password: passwordProblem ? t(passwordProblem.key, passwordProblem.vars) : undefined,
        confirmPassword: confirmProblem ? t(confirmProblem.key, confirmProblem.vars) : undefined,
      })
      return
    }

    setFieldErrors({})
    onSubmit({
      firstName: String(data.get('firstName') ?? '').trim(),
      // Omitted rather than sent empty: the column is nullable and "" is not a last name.
      ...(lastName ? { lastName } : {}),
      username,
      email: String(data.get('email') ?? '').trim(),
      phoneNumber: String(data.get('phoneNumber') ?? ''),
      password,
    })
  }

  return (
    <form className="mt-5 space-y-3.5" onSubmit={handleSubmit}>
      {error && <AuthError message={error} />}

      <AuthField
        name="firstName"
        label={t('auth.firstName')}
        type="text"
        autoComplete="given-name"
        maxLength={128}
        icon={<UserIcon size={16} />}
      />
      <AuthField
        name="lastName"
        label={t('auth.lastName')}
        type="text"
        autoComplete="family-name"
        required={false}
        maxLength={128}
        icon={<UserIcon size={16} />}
      />
      <AuthField
        name="username"
        label={t('auth.username')}
        type="text"
        autoComplete="username"
        maxLength={MAX_USERNAME_LENGTH}
        error={fieldErrors.username}
        icon={<AtIcon size={16} />}
      />
      <AuthField
        name="email"
        label={t('auth.email')}
        type="email"
        autoComplete="email"
        maxLength={256}
        icon={<MailIcon size={16} />}
      />
      {/* Composite control (country picker + digits), not `required` — see `PhoneField`. */}
      <PhoneField name="phoneNumber" label={t('auth.phone')} defaultCountry={defaultCountry} />
      <AuthField
        name="password"
        label={t('auth.password')}
        type="password"
        autoComplete="new-password"
        maxLength={MAX_PASSWORD_LENGTH}
        error={fieldErrors.password}
        icon={<LockIcon size={16} />}
        revealed={passwordRevealed}
        onToggleRevealed={() => setPasswordRevealed((value) => !value)}
      />
      <AuthField
        name="confirmPassword"
        label={t('auth.confirmPassword')}
        type="password"
        autoComplete="new-password"
        maxLength={MAX_PASSWORD_LENGTH}
        error={fieldErrors.confirmPassword}
        icon={<LockIcon size={16} />}
        revealed={passwordRevealed}
        onToggleRevealed={() => setPasswordRevealed((value) => !value)}
      />

      <AuthSubmitButton disabled={isSubmitting}>
        {isSubmitting ? t('auth.submitting') : t('auth.submitRegister')}
      </AuthSubmitButton>
    </form>
  )
}
