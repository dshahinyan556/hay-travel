import { useState } from 'react'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import type { RegisterRequest } from '@/shared/auth'
import {
  MAX_PASSWORD_LENGTH,
  MAX_USERNAME_LENGTH,
  validatePassword,
  validateUsername,
} from '../lib/passwordRules'
import { AuthField } from './AuthField'
import { AuthError, AuthSubmitButton } from './AuthShell'

interface RegisterFormProps {
  onSubmit: (request: RegisterRequest) => void
  error: string | null
  isSubmitting: boolean
}

/** Field-level messages, keyed by input name. */
type FieldErrors = Partial<Record<'username' | 'password', string>>

/**
 * Presentational sign-up form. Field set mirrors `RegisterModel` exactly — including `Username`,
 * which the backend requires (unique, min 3) and which the old presentation-only mock did not
 * have. The phone field keeps its digits-only behaviour unchanged (see `AuthField`).
 *
 * Local validation is limited to the two rules the server reports as bodyless `ProblemDetails`
 * (username and password length): everything else either has a real error code or is covered by
 * the inputs' own `type`/`required`.
 */
export function RegisterForm({ onSubmit, error, isSubmitting }: RegisterFormProps) {
  const { t } = useLocale()
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)

    const username = String(data.get('username') ?? '').trim()
    const password = String(data.get('password') ?? '')
    const lastName = String(data.get('lastName') ?? '').trim()

    const usernameProblem = validateUsername(username)
    const passwordProblem = validatePassword(password)
    if (usernameProblem || passwordProblem) {
      setFieldErrors({
        username: usernameProblem ? t(usernameProblem.key, usernameProblem.vars) : undefined,
        password: passwordProblem ? t(passwordProblem.key, passwordProblem.vars) : undefined,
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
      />
      <AuthField
        name="lastName"
        label={t('auth.lastName')}
        type="text"
        autoComplete="family-name"
        required={false}
        maxLength={128}
      />
      <AuthField
        name="username"
        label={t('auth.username')}
        type="text"
        autoComplete="username"
        maxLength={MAX_USERNAME_LENGTH}
        error={fieldErrors.username}
      />
      <AuthField name="email" label={t('auth.email')} type="email" autoComplete="email" maxLength={256} />
      <AuthField
        name="phoneNumber"
        label={t('auth.phone')}
        type="tel"
        autoComplete="tel"
        inputMode="numeric"
        maxLength={15}
        onlyDigits
      />
      <AuthField
        name="password"
        label={t('auth.password')}
        type="password"
        autoComplete="new-password"
        maxLength={MAX_PASSWORD_LENGTH}
        error={fieldErrors.password}
      />

      <AuthSubmitButton disabled={isSubmitting}>
        {isSubmitting ? t('auth.submitting') : t('auth.submitRegister')}
      </AuthSubmitButton>
    </form>
  )
}
