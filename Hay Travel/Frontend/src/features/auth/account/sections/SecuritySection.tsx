import { useState } from 'react'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import type { UserInfoModel } from '@/shared/auth'
import { AccountSection } from '../components/AccountSection'
import { EmailChangeForm } from '../components/EmailChangeForm'
import { PasswordChangeForm } from '../components/PasswordChangeForm'
import { PhoneChangeForm } from '../components/PhoneChangeForm'
import { SessionsSection } from '../components/SessionsSection'

/** Which editor is expanded. At most one: these are mutually exclusive operations, and a
 * half-finished email flow left open under a password form is noise. `'sessions'` is not an editor
 * but plays by the same rule — it is a tall list that would push everything below it off screen. */
type OpenPanel = 'email' | 'phone' | 'password' | 'sessions' | null

interface SecuritySectionProps {
  currentEmail: string
  /** Backend storage format: calling code, no leading `+` (see `updatePhone`). `null` = not set. */
  currentPhone: string | null
  /** Hands the saved profile back up so the page's copy of it stays current without re-running the
   * loader for one field — the contract `PhoneChangeForm.onSaved` already had. */
  onPhoneSaved: (profile: UserInfoModel) => void
}

/**
 * «Безопасность» — the credentials you sign in with.
 *
 * Nothing is reinvented here: the same accordions, the same «at most one open» rule, the same
 * current value visible while collapsed. The argument in `AccountSection` still holds — it simply
 * governs a section now instead of the whole page.
 *
 * Two changes against what used to live on `/account`:
 *  - Telegram moved out to «Подключения». Next to a password and an email it read as a way to log
 *    IN; it is a channel we talk to you THROUGH.
 *  - The section gained a subtitle. Without it «Телефон» here and «Телефон» in «Способы связи»
 *    look like the same field, and they are not: one is the account, the other is who to call
 *    about a specific order.
 *
 * «Активные сеансы» stays: it is credential-adjacent by definition, and there is no other section
 * in the cabinet it could belong to. Its list is still NOT fetched by `accountLoader` — the panel
 * is collapsed by default, and a third blocking request before first paint would be paid by
 * everyone to serve the few who open it.
 */
export function SecuritySection({ currentEmail, currentPhone, onPhoneSaved }: SecuritySectionProps) {
  const { t } = useLocale()
  const [open, setOpen] = useState<OpenPanel>(null)

  const toggle = (panel: Exclude<OpenPanel, null>) =>
    setOpen((current) => (current === panel ? null : panel))

  return (
    <div className="flex flex-col gap-4">
      <h2 className="card-title text-ink">{t('account.sectionSecurity')}</h2>

      <div className="flex flex-col gap-3">
        <AccountSection
          title={t('auth.email')}
          currentValue={currentEmail}
          open={open === 'email'}
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
          open={open === 'phone'}
          onToggle={() => toggle('phone')}
          toggleLabel={t('account.changePhoneAria')}
        >
          <PhoneChangeForm currentPhone={currentPhone} onSaved={onPhoneSaved} />
        </AccountSection>

        <AccountSection
          title={t('auth.password')}
          currentValue={<span className="text-ink-muted">••••••••</span>}
          open={open === 'password'}
          onToggle={() => toggle('password')}
          toggleLabel={t('account.changePasswordAria')}
        >
          <PasswordChangeForm />
        </AccountSection>

        {/* Last on purpose: this is not a setting, it is security — people come here for a reason,
            not in passing. */}
        <AccountSection
          title={t('account.sessions')}
          currentValue={<span className="text-ink-muted">{t('account.sessionsSummary')}</span>}
          open={open === 'sessions'}
          onToggle={() => toggle('sessions')}
          toggleLabel={t('account.sessionsAria')}
          actionLabel={t('account.sessionsShow')}
        >
          <SessionsSection />
        </AccountSection>
      </div>
    </div>
  )
}
