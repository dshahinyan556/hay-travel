import { useState } from 'react'
import { Link, redirect, useLoaderData, useNavigate } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import {
  canOpenAdminPanel,
  ensureAuthReady,
  logout,
  useAuth,
  type UserInfoModel,
} from '@/shared/auth'
import { AuthShell } from '../components/AuthShell'
import { withReturnTo } from '@/shared/lib/returnTo'
import { getMe } from './api/account'
import { AccountSection } from './components/AccountSection'
import { EmailChangeForm } from './components/EmailChangeForm'
import { PasswordChangeForm } from './components/PasswordChangeForm'
import { PhoneChangeForm } from './components/PhoneChangeForm'
import { ProfileSummary } from './components/ProfileSummary'

/**
 * Guard + profile fetch for `/account` (ADR 010, decisions 2 and 4).
 *
 * The guard is a LOADER, not an effect: it runs before the route renders, so an anonymous visitor
 * never sees a flash of an empty account screen — the same pattern as `adminRootLoader`. It also
 * carries the destination in `?returnTo=`, so signing in lands back here.
 *
 * `GET api/Account/Me` failing does NOT fail the route: everything except the name is available
 * from the token-derived `AuthUser`, so a dead profile request degrades two rows to «—» instead of
 * replacing the whole screen with an error.
 */
export async function accountLoader() {
  const state = await ensureAuthReady()
  if (!state.user) throw redirect(withReturnTo('/auth', '/account'))

  const profile = await getMe().catch(() => null)
  return { profile }
}

/** Which editor is open. At most one: the three are mutually exclusive operations, and an
 * abandoned half-finished email flow sitting open under another form is noise. */
type OpenSection = 'email' | 'phone' | 'password' | null

export function AccountPage() {
  const { profile } = useLoaderData<typeof accountLoader>()
  const { t } = useLocale()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [openSection, setOpenSection] = useState<OpenSection>(null)
  /** Locally applied result of a successful phone save, so the collapsed section shows the new
   * number without re-running the loader (which would also refetch the profile for one field). */
  const [savedProfile, setSavedProfile] = useState<UserInfoModel | null>(null)
  const [isLeaving, setIsLeaving] = useState(false)

  // `useAuth` can momentarily report `null` during a sign-out initiated from this very screen; the
  // loader has already proven there was a session, so this is a render guard, not a permission one.
  if (!user) return null

  const effectiveProfile = savedProfile ?? profile
  const currentEmail = effectiveProfile?.email ?? user.email
  const currentPhone = effectiveProfile?.phoneNumber ?? user.phoneNumber ?? null

  const toggle = (section: Exclude<OpenSection, null>) =>
    setOpenSection((current) => (current === section ? null : section))

  async function handleLogout() {
    setIsLeaving(true)
    try {
      await logout()
      navigate('/')
    } finally {
      setIsLeaving(false)
    }
  }

  return (
    <AuthShell title={t('account.title')} subtitle={currentEmail} width="page">
      <div className="flex flex-col gap-6">
        <ProfileSummary user={user} profile={effectiveProfile} />

        <div className="flex flex-col gap-3">
          <AccountSection
            title={t('auth.email')}
            currentValue={currentEmail}
            open={openSection === 'email'}
            onToggle={() => toggle('email')}
            toggleLabel={t('account.changeEmailAria')}
          >
            <EmailChangeForm currentEmail={currentEmail} />
          </AccountSection>

          <AccountSection
            title={t('auth.phone')}
            currentValue={
              currentPhone ? (
                <span className="tabular-nums">+{currentPhone}</span>
              ) : (
                <span className="text-ink-muted">{t('account.phoneNotSet')}</span>
              )
            }
            open={openSection === 'phone'}
            onToggle={() => toggle('phone')}
            toggleLabel={t('account.changePhoneAria')}
          >
            <PhoneChangeForm currentPhone={currentPhone} onSaved={setSavedProfile} />
          </AccountSection>

          <AccountSection
            title={t('auth.password')}
            currentValue={<span className="text-ink-muted">••••••••</span>}
            open={openSection === 'password'}
            onToggle={() => toggle('password')}
            toggleLabel={t('account.changePasswordAria')}
          >
            <PasswordChangeForm />
          </AccountSection>
        </div>

        <div className="flex flex-col gap-2.5 border-t border-edge pt-5">
          {/* Staff only — for everyone else this link does not exist, same rule the header's user
              menu applies. */}
          {canOpenAdminPanel(user) && (
            <Link
              to="/admin"
              className="w-full rounded-full bg-gold-fill px-5 py-3 text-center text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none"
            >
              {t('auth.goToPanel')}
            </Link>
          )}
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLeaving}
            className="w-full cursor-pointer rounded-full px-5 py-3 text-center text-sm text-ink-dim transition-colors hover:text-danger focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('auth.logout')}
          </button>
        </div>
      </div>
    </AuthShell>
  )
}
