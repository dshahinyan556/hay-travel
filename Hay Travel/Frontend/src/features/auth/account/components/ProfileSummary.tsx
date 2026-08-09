import type { ReactNode } from 'react'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import type { AuthUser, UserInfoModel } from '@/shared/auth'
import { roleLabelKey } from '../../lib/roleLabels'

interface ProfileSummaryProps {
  /** Always available — rebuilt from the token on a cold reload, so it is the reliable source for
   * login/email/role. */
  user: AuthUser
  /** `GET api/Account/Me`, or `null` when that request failed. It is the ONLY source of first/last
   * name, so those rows degrade to a dash rather than the screen failing. */
  profile: UserInfoModel | null
}

/**
 * The read-only top of `/account`: who you are.
 *
 * Nothing here is editable, by explicit product decision (A6): the login is a unique key and the
 * name is not something a customer changes themselves. So this is a description list, not a form —
 * and the three editable things live in the `AccountSection`s below it.
 *
 * Presentational: it renders what it is handed and makes no requests of its own.
 */
export function ProfileSummary({ user, profile }: ProfileSummaryProps) {
  const { t } = useLocale()

  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ')
  const isVerified = profile?.isEmailVerified ?? user.isEmailVerified

  return (
    <dl className="flex flex-col gap-3 sm:grid sm:grid-cols-2">
      <Row label={t('account.fullName')} value={fullName || undefined} />
      <Row label={t('auth.username')} value={user.username} />
      <Row label={t('auth.accountRole')} value={t(roleLabelKey(user.role))} />
      <Row
        label={t('account.emailStatus')}
        value={
          <span className={isVerified ? 'text-ink' : 'text-danger'}>
            {isVerified ? t('account.emailVerified') : t('account.emailUnverified')}
          </span>
        }
      />
    </dl>
  )
}

/** `undefined` renders as a muted dash — the honest representation of "we could not load this",
 * which is a real state here whenever `GET api/Account/Me` failed. */
function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] font-semibold tracking-[.14em] text-ink-muted uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm break-words text-ink">
        {value ?? <span className="text-ink-muted">—</span>}
      </dd>
    </div>
  )
}
