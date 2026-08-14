import { useState } from 'react'
import { Link } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { AuthField } from '../../components/AuthField'
import { AuthError, AuthNotice, AuthSubmitButton } from '../../components/AuthShell'
import { useEmailChangeFlow } from '../hooks/useEmailChangeFlow'

interface EmailChangeFormProps {
  /** The address that owns the account today — where step 1's code is sent. */
  currentEmail: string
}

/**
 * Steps 1-3 of the email change, inline on `/account` (step 4 happens in the NEW mailbox, on
 * `/auth/confirm-email-change`).
 *
 * All the flow logic is in `useEmailChangeFlow`; this component renders one of four states and
 * feeds the hook. Each step is its own `<form>` so Enter submits the field the visitor is in, and
 * so the browser never sees one form whose meaning changes underneath it.
 */
export function EmailChangeForm({ currentEmail }: EmailChangeFormProps) {
  const { t } = useLocale()
  const flow = useEmailChangeFlow(t)
  const [code, setCode] = useState('')

  return (
    <div className="flex flex-col gap-3.5">
      {flow.error && <AuthError message={flow.error} />}

      {flow.step === 'idle' && (
        <form
          className="flex flex-col gap-3.5"
          onSubmit={(event) => {
            event.preventDefault()
            flow.start()
          }}
        >
          <p className="text-sm text-ink-dim">{t('account.emailIntro', { email: currentEmail })}</p>
          <AuthSubmitButton disabled={flow.pending}>
            {flow.pending ? t('auth.submitting') : t('account.emailStart')}
          </AuthSubmitButton>
        </form>
      )}

      {flow.step === 'code-sent' && (
        <form
          className="flex flex-col gap-3.5"
          onSubmit={(event) => {
            event.preventDefault()
            const trimmed = code.trim()
            if (trimmed) flow.submitCode(trimmed)
          }}
        >
          <AuthNotice message={t('account.emailCodeSent', { email: currentEmail })} />
          <DevToken token={flow.devToken} hint={t('account.devCodeHint')} />
          <label className="block">
            <span className="text-[11px] font-semibold tracking-[.14em] text-ink-muted uppercase">
              {t('account.emailCodeLabel')}
            </span>
            <input
              // Controlled (unlike `AuthField`, which is uncontrolled by design): the submit button
              // has to disable itself on an empty code, which needs the value in React state.
              value={code}
              onChange={(event) => setCode(event.currentTarget.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={16}
              className="mt-1.5 h-[46px] w-full rounded-xl bg-panel-raised px-3.5 text-center text-lg tracking-[.3em] text-ink ring-1 ring-edge-strong transition-colors outline-none focus:ring-2 focus:ring-focus"
            />
          </label>
          <AuthSubmitButton disabled={flow.pending || code.trim() === ''}>
            {flow.pending ? t('auth.submitting') : t('account.emailCodeSubmit')}
          </AuthSubmitButton>
          <CancelButton label={t('account.cancel')} onClick={flow.reset} disabled={flow.pending} />
        </form>
      )}

      {flow.step === 'new-email' && (
        <form
          className="flex flex-col gap-3.5"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            const email = String(data.get('newEmail') ?? '').trim()
            if (email) flow.submitNewEmail(email)
          }}
        >
          <AuthNotice message={t('account.emailCodeAccepted')} />
          <AuthField
            name="newEmail"
            label={t('account.newEmailLabel')}
            type="email"
            autoComplete="email"
            maxLength={256}
            autoFocus
          />
          <AuthSubmitButton disabled={flow.pending}>
            {flow.pending ? t('auth.submitting') : t('account.newEmailSubmit')}
          </AuthSubmitButton>
          <CancelButton label={t('account.cancel')} onClick={flow.reset} disabled={flow.pending} />
        </form>
      )}

      {flow.step === 'link-sent' && (
        <>
          <AuthNotice message={t('account.emailLinkSent', { email: flow.targetEmail ?? '' })} />
          <DevToken token={flow.devToken} hint={t('auth.devTokenHint')} />
          <p className="text-sm text-ink-dim">{t('account.emailLinkLogoutWarning')}</p>
        </>
      )}
    </div>
  )
}

/** Secondary action inside a step — a plain button, so it never submits the form it sits in. */
function CancelButton({
  label,
  onClick,
  disabled,
}: {
  label: string
  onClick: () => void
  disabled: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="cursor-pointer text-center text-sm text-ink-dim transition-colors hover:text-gold-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
    >
      {label}
    </button>
  )
}

/**
 * Development-only shortcut. `devToken` is populated exclusively by `DevEmailSender` (no SendGrid
 * key configured), so in production this renders nothing at all — the same contract, and the same
 * treatment, as `CheckEmailPage`'s dev link.
 *
 * For step 1's CODE the token is the code itself and there is nowhere to link to; for step 3 it is
 * the confirmation token, which is worth linking straight to the page that spends it.
 */
function DevToken({ token, hint }: { token: string | null; hint: string }) {
  if (!token) return null
  const isLink = token.length > 16

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-panel px-3.5 py-3 ring-1 ring-edge-strong">
      <span className="text-xs text-ink-muted">{hint}</span>
      {isLink ? (
        <Link
          to={`/auth/confirm-email-change?token=${encodeURIComponent(token)}`}
          className="text-sm text-gold-ink underline-offset-4 transition-colors hover:text-accent-strong hover:underline"
        >
          {token}
        </Link>
      ) : (
        <code className="font-mono text-sm break-all text-gold-ink">{token}</code>
      )}
    </div>
  )
}
