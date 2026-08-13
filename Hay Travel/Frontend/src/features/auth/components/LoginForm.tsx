import { Link } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import type { LoginRequest } from '@/shared/auth'
import { LockIcon, UserIcon } from '@/shared/ui/icons'
import { Reveal } from '@/shared/ui'
import { AuthField } from './AuthField'
import { AuthError, AuthSubmitButton, AuthSuccess } from './AuthShell'

interface LoginFormProps {
  onSubmit: (request: LoginRequest) => void
  /** Already-translated, form-level failure (bad credentials, locked, unverified…). */
  error: string | null
  /**
   * Общий статус отправки, приходит из AuthPage. Спелён здесь, а не импортирован из `AuthPage`:
   * форма — презентационная и не должна зависеть от своего контейнера.
   */
  status: 'idle' | 'submitting' | 'success'
  /** Carried onto the "forgot password" link so the visitor returns here afterwards. */
  forgotPasswordHref: string
}

/**
 * Presentational sign-in form. Owns no state: values are read from the DOM at submit
 * (see `AuthField`), everything else comes from `AuthPage`.
 *
 * One field for both identifiers — the backend's `UsernameOrEmail` accepts either, so asking the
 * visitor to remember which they signed up with would be a needless obstacle.
 *
 * ── Why the structure below is exactly this (Spec 005) ────────────────────────────────────────
 *  - `<fieldset disabled>` is the native way to stop accepting input in one move: it disables the
 *    fields AND the eye toggle inside them. No per-field `disabled` bookkeeping. `m-0 border-0 p-0`
 *    strips the browser's own fieldset chrome.
 *  - The submit button sits OUTSIDE the fieldset on purpose. Inside it, `disabled` would suppress
 *    `aria-busy` and the spinner, and the button would stop being announced at all.
 *  - `<Reveal group>` WRAPS the form rather than being it: `RevealTag` has no `'form'` member, and
 *    `.reveal-group .reveal-item` is a descendant selector — the depth does not matter.
 *  - `.reveal-item` goes on wrapper `<div>`s, never on `AuthField` itself: `AuthField` carries its
 *    own `transition-colors`, and index.css (~line 538) forbids stacking the two — the unlayered
 *    reveal rules would win.
 *  - `AuthSuccess`/`AuthError` are direct children, so their appearance shifts the fields'
 *    `:nth-child` wave index by one. Not compensated on purpose: the wave plays once on arrival,
 *    when neither banner exists.
 *  - "Забыли пароль?" stays clickable inside the disabled fieldset (`<a>` is not a form control).
 *    Accepted: leaving the page mid-request breaks nothing.
 */
export function LoginForm({ onSubmit, error, status, forgotPasswordHref }: LoginFormProps) {
  const { t } = useLocale()
  const isBusy = status !== 'idle'

  return (
    <Reveal group className="mt-5">
      <form
        className="space-y-3.5"
        onSubmit={(e) => {
          e.preventDefault()
          const data = new FormData(e.currentTarget)
          onSubmit({
            usernameOrEmail: String(data.get('usernameOrEmail') ?? '').trim(),
            password: String(data.get('password') ?? ''),
          })
        }}
      >
        {status === 'success' && <AuthSuccess message={t('auth.successLogin')} />}
        {error && <AuthError message={error} />}

        <fieldset
          disabled={isBusy}
          className="m-0 space-y-3.5 border-0 p-0 transition-opacity duration-[var(--dur-fast)] disabled:opacity-55"
        >
          <div className="reveal-item">
            <AuthField
              name="usernameOrEmail"
              label={t('auth.usernameOrEmail')}
              type="text"
              autoComplete="username"
              maxLength={256}
              icon={<UserIcon size={16} />}
              invalid={Boolean(error)}
            />
          </div>
          <div className="reveal-item">
            <AuthField
              name="password"
              label={t('auth.password')}
              type="password"
              autoComplete="current-password"
              maxLength={128}
              icon={<LockIcon size={16} />}
              invalid={Boolean(error)}
            />
          </div>

          <p className="reveal-item text-right">
            <Link
              to={forgotPasswordHref}
              className="link-underline text-xs text-gold-ink hover:text-accent-strong"
            >
              {t('auth.forgotPassword')}
            </Link>
          </p>
        </fieldset>

        <AuthSubmitButton
          isLoading={status === 'submitting'}
          isSuccess={status === 'success'}
        >
          {status === 'submitting'
            ? t('auth.checking')
            : status === 'success'
              ? t('auth.signedIn')
              : t('auth.submitLogin')}
        </AuthSubmitButton>
      </form>
    </Reveal>
  )
}
