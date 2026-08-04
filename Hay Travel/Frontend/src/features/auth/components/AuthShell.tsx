import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { MountainIcon } from '@/shared/ui/icons'

interface AuthShellProps {
  title: string
  subtitle?: string
  /** Card contents — the form, the status message, whatever the screen needs. */
  children: ReactNode
  /** Small print under the card (only the sign-up screen uses it, for the terms line). */
  note?: string
}

/**
 * The frame every `/auth` screen shares: centred column, brand mark, heading pair, one panel
 * card, and the way back to the site.
 *
 * Extracted verbatim from the original single-screen `AuthPage` so the six screens cannot drift
 * apart visually. `max-w-md` + `px-4` keeps it comfortable at 375px with no separate mobile
 * layout; the vertical rhythm loosens from `py-16` to `py-24` from `sm` up.
 */
export function AuthShell({ title, subtitle, children, note }: AuthShellProps) {
  const { t } = useLocale()

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-16 sm:py-24">
      <div className="flex flex-col items-center text-center">
        <span className="text-gold-ink">
          <MountainIcon size={28} />
        </span>
        <h1 className="text-gold-sheen mt-3 font-display text-3xl">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-ink-muted">{subtitle}</p>}
      </div>

      <div className="mt-8 rounded-2xl bg-panel p-6 ring-1 ring-edge">{children}</div>

      {note && <p className="mt-4 text-center text-xs text-ink-muted">{note}</p>}

      <Link
        to="/"
        className="mt-6 text-center text-sm text-ink-dim transition-colors hover:text-gold-ink"
      >
        {t('auth.backHome')}
      </Link>
    </div>
  )
}

/** The screens' primary call to action — the gold pill button, shared so the six screens can't
 * drift. Renders as a `<button>`; disabled while a request is in flight. */
export function AuthSubmitButton({
  children,
  disabled,
}: {
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full rounded-full bg-gold-fill px-5 py-3 text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  )
}

/** Form-level failure message. `role="alert"` so a screen reader announces it when it appears
 * after a failed submit. */
export function AuthError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger ring-1 ring-danger/40"
    >
      {message}
    </p>
  )
}

/** Positive/neutral status message in the same shape as `AuthError`. */
export function AuthNotice({ message }: { message: string }) {
  return (
    <p className="rounded-xl bg-panel-raised px-3.5 py-2.5 text-sm text-ink-dim ring-1 ring-edge-strong">
      {message}
    </p>
  )
}
