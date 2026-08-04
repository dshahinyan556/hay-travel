import { Link } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { canOpenAdminPanel, type AuthUser } from '@/shared/auth'
import { roleLabelKey } from '../lib/roleLabels'

interface AccountPanelProps {
  user: AuthUser
  onLogout: () => void
  isLoggingOut: boolean
}

/**
 * What `/auth` shows to someone who is already signed in.
 *
 * Rendering the login tabs to a signed-in visitor is the confusing alternative — this states who
 * they are and offers the three things they can do from here. The panel link only appears for
 * staff (`canOpenAdminPanel`); for everyone else the section does not exist.
 */
export function AccountPanel({ user, onLogout, isLoggingOut }: AccountPanelProps) {
  const { t } = useLocale()
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ')

  return (
    <div className="flex flex-col gap-4">
      <dl className="flex flex-col gap-2.5 text-sm">
        <div className="flex flex-col">
          <dt className="text-xs text-ink-muted">{t('auth.username')}</dt>
          <dd className="text-ink break-all">{fullName ? `${fullName} (${user.username})` : user.username}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs text-ink-muted">{t('auth.email')}</dt>
          <dd className="text-ink break-all">{user.email}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs text-ink-muted">{t('auth.accountRole')}</dt>
          <dd className="text-ink">{t(roleLabelKey(user.role))}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-2.5">
        {canOpenAdminPanel(user.role) && (
          <Link
            to="/admin"
            className="w-full rounded-full bg-gold-fill px-5 py-3 text-center text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none"
          >
            {t('auth.goToPanel')}
          </Link>
        )}
        <Link
          to="/auth/change-password"
          className="w-full rounded-full px-5 py-3 text-center text-sm text-ink-dim ring-1 ring-edge-strong transition-colors hover:text-gold-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
        >
          {t('auth.changePasswordTitle')}
        </Link>
        <button
          type="button"
          onClick={onLogout}
          disabled={isLoggingOut}
          className="w-full rounded-full px-5 py-3 text-center text-sm text-ink-dim transition-colors hover:text-danger focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t('auth.logout')}
        </button>
      </div>
    </div>
  )
}
