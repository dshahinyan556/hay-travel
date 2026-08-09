import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { useAuth } from '@/shared/auth'
import { PasswordChangeForm } from './account/components/PasswordChangeForm'
import { AuthShell, AuthNotice } from './components/AuthShell'
import { readReturnTo, withReturnTo } from './lib/returnTo'

/**
 * `/auth/change-password` — change your own password while signed in.
 *
 * KEPT as its own route even though `/account` now has a «Пароль» section, because it is the
 * destination of the FORCED change redirect (`forceChangePassword` on the login response, re-checked
 * by `adminRootLoader`). Folding it into `/account` would mean forcing a user who must change their
 * password into a screen full of other things they may not do yet.
 *
 * The form itself lives in `account/components/PasswordChangeForm` and is shared with `/account`;
 * what remains here is what only this route needs: the guard, the shell, the "why you are here"
 * notice, and honouring `?returnTo=` after a forced change.
 *
 * Guarded client-side by an effect rather than a loader, unlike `/account`: this is a plain page
 * under `RootLayout` with no loader of its own, and adding one purely for the guard would also add
 * a revalidation on every navigation back. The endpoint is `[Authorize]` regardless.
 */
export function ChangePasswordPage() {
  const { t } = useLocale()
  const navigate = useNavigate()
  const location = useLocation()
  const { status, user, forceChangePassword } = useAuth()
  const returnTo = readReturnTo(location.search)

  /**
   * Latches whether the visitor arrived here under duress.
   *
   * Needed because `PasswordChangeForm` calls `clearForceChangePassword()` on success — by the time
   * `onSuccess` runs, the live flag is already `false`, so the decision to auto-forward has to be
   * remembered from before the submit.
   */
  const wasForcedRef = useRef(false)
  useEffect(() => {
    if (forceChangePassword) wasForcedRef.current = true
  }, [forceChangePassword])

  // `status` is 'idle'/'loading' during a cold reload — waiting for it avoids bouncing a signed-in
  // user out on F5 just because the session hadn't been restored yet.
  const isResolved = status === 'authenticated' || status === 'anonymous'

  useEffect(() => {
    if (isResolved && !user) {
      navigate(withReturnTo('/auth', `${location.pathname}${location.search}`), { replace: true })
    }
  }, [isResolved, user, navigate, location.pathname, location.search])

  if (!user) return null

  return (
    <AuthShell title={t('auth.changePasswordTitle')} subtitle={user.email}>
      <div className="flex flex-col gap-3.5">
        {forceChangePassword && <AuthNotice message={t('auth.forceChangeNotice')} />}
        <PasswordChangeForm
          autoFocus
          onSuccess={() => {
            // Only auto-forward someone who was sent here against their will; a visitor who came
            // deliberately should see the confirmation instead of being bounced away from it.
            if (wasForcedRef.current) navigate(returnTo, { replace: true })
          }}
        />
      </div>
    </AuthShell>
  )
}
