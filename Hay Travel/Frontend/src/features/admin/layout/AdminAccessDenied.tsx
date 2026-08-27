import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { logout, type AuthUser } from '@/shared/auth'
import { Button, buttonClassName } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminLayoutCopy } from './adminLayoutCopy'

interface AdminAccessDeniedProps {
  user: AuthUser
}

/**
 * Shown to a signed-in visitor whose role cannot open the panel (`Regular`).
 *
 * Full-screen and WITHOUT the sidebar on purpose: rendering the panel chrome around a refusal
 * would suggest there is something behind it. It states which account is being refused — the
 * usual cause is being signed in as the wrong user — and offers both ways out (back to the public
 * site, or sign out and use another account).
 */
export function AdminAccessDenied({ user }: AdminAccessDeniedProps) {
  const navigate = useNavigate()
  const copy = useCopy(adminLayoutCopy)
  const [isLeaving, setIsLeaving] = useState(false)

  async function handleLogout() {
    setIsLeaving(true)
    try {
      await logout()
      navigate('/auth', { replace: true })
    } finally {
      setIsLeaving(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
        <span
          aria-hidden="true"
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-2xl text-neutral-700"
        >
          🔒
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-lg font-bold text-neutral-900">{copy.accessDenied.title}</h1>
          <p className="text-sm text-neutral-600">
            {copy.accessDenied.messageBefore}
            <span className="font-semibold text-neutral-900 break-all">{user.email}</span>
            {copy.accessDenied.messageAfter}
          </p>
        </div>
        <div className="mt-1 flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
          <Link to="/" className={buttonClassName('primary', 'md')}>
            {copy.backToSite}
          </Link>
          <Button type="button" variant="ghost" onClick={handleLogout} disabled={isLeaving}>
            {isLeaving ? copy.logoutPending : copy.logout}
          </Button>
        </div>
      </div>
    </div>
  )
}
