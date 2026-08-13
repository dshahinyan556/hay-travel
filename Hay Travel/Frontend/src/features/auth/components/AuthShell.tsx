import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { Spinner } from '@/shared/ui'
import { AlertIcon, CheckIcon, MountainIcon } from '@/shared/ui/icons'

interface AuthShellProps {
  title: string
  subtitle?: string
  /** Card contents — the form, the status message, whatever the screen needs. */
  children: ReactNode
  /** Small print under the card (only the sign-up screen uses it, for the terms line). */
  note?: string
  /**
   * How wide the column is.
   *
   * `'form'` (default) is the original `max-w-md` — right for a single stack of inputs, and what
   * every `/auth` screen still uses. `'page'` widens it to `max-w-2xl` for `/account`, which is not
   * one form but several collapsible sections plus a read-only profile block; at `max-w-md` those
   * section headers (label + current value + toggle on one line) would wrap on a desktop screen for
   * no reason. Additive: no existing caller changes.
   */
  width?: 'form' | 'page'
}

const WIDTH_CLASS: Record<'form' | 'page', string> = {
  form: 'max-w-md',
  page: 'max-w-2xl',
}

/**
 * The frame the TRANSACTIONAL auth screens share: centred column, brand mark, heading pair, one
 * panel card, and the way back to the site.
 *
 * There are two auth shells on purpose (ADR 017), and this is not the leftover one. This serves
 * `/auth/check-email`, `/verify`, `/forgot-password`, `/reset-password`, `/change-password`,
 * `/confirm-email-change` and `/account` — screens people reach from an email link, whose job is
 * to state a result and get out of the way. `/auth` itself, the one entry point reached FROM the
 * site, uses `AuthSplitLayout`. A new auth screen defaults to this one.
 *
 * `px-4` keeps it comfortable at 375px with no separate mobile layout at either width; the
 * vertical rhythm loosens from `py-16` to `py-24` from `sm` up.
 */
export function AuthShell({ title, subtitle, children, note, width = 'form' }: AuthShellProps) {
  const { t } = useLocale()

  return (
    <div className={`mx-auto flex w-full ${WIDTH_CLASS[width]} flex-col px-4 py-16 sm:py-24`}>
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

/**
 * The screens' primary call to action — the gold pill button, shared by BOTH shells so the eight
 * screens can't drift. Renders as a `<button>`; disabled while a request is in flight.
 *
 * `isLoading`/`isSuccess` are additive (Spec 005): the six transactional screens pass neither and
 * behave exactly as before, gaining only `.btn-motion`.
 */
export function AuthSubmitButton({
  children,
  disabled,
  isLoading = false,
  isSuccess = false,
}: {
  children: ReactNode
  disabled?: boolean
  /** Запрос в полёте: спиннер слева от подписи, `cursor-progress`, `aria-busy`. */
  isLoading?: boolean
  /** Кратковременное подтверждение перед переходом: зелёная заливка + галочка. */
  isSuccess?: boolean
}) {
  return (
    <button
      type="submit"
      disabled={disabled || isLoading || isSuccess}
      aria-busy={isLoading || undefined}
      // `.btn-motion` REPLACES `transition-colors` here rather than joining it: it is unlayered
      // CSS and declares the colour half itself, so it would win over the utility anyway and the
      // two `transition` declarations would fight (see the warning in index.css ~line 680).
      className={`btn-motion inline-flex w-full items-center justify-center gap-2.5 rounded-full px-5 py-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
        isSuccess
          ? 'bg-success text-gold-on'
          : 'bg-gold-fill text-gold-on hover:bg-gold-fill-hover'
      } ${isLoading ? 'cursor-progress' : ''}`}
    >
      {isLoading && <Spinner size="sm" />}
      {isSuccess && <CheckIcon size={17} />}
      {children}
    </button>
  )
}

/** Form-level failure message. `role="alert"` so a screen reader announces it when it appears
 * after a failed submit — that is non-negotiable, the message matters more than the entrance.
 * No shake: it would be movement for its own sake, and movement is exactly what gets switched
 * off for the people who need the message read out most calmly. */
export function AuthError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="alert-in flex items-start gap-2.5 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger ring-1 ring-danger/40"
    >
      <AlertIcon size={17} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </p>
  )
}

/** Twin of `AuthError` for a positive outcome. `role="status"`, not `alert`: this is not an
 * error, and `alert` would interrupt the screen reader for good news. */
export function AuthSuccess({ message }: { message: string }) {
  return (
    <p
      role="status"
      className="alert-in flex items-start gap-2.5 rounded-xl bg-success-soft px-3.5 py-2.5 text-sm text-success ring-1 ring-success/40"
    >
      <CheckIcon size={17} className="mt-0.5 shrink-0" />
      <span>{message}</span>
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
