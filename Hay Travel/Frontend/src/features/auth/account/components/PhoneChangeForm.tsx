import { useState } from 'react'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { applyUser, toAuthUser, type UserInfoModel } from '@/shared/auth'
import { PhoneField } from '../../components/PhoneField'
import { AuthError, AuthNotice, AuthSubmitButton } from '../../components/AuthShell'
import { useDefaultPhoneCountry } from '../../hooks/useDefaultPhoneCountry'
import { updatePhone } from '../api/account'
import { accountErrorMessageKey } from '../lib/accountErrors'

interface PhoneChangeFormProps {
  /** The stored number in the backend's format (calling code, no leading `+`), or `null`/empty when
   * the account has none — seeds the field so the visitor sees what they are replacing. */
  currentPhone: string | null
  /** Hands the updated profile back so the page can re-render the section's current value. */
  onSaved: (user: UserInfoModel) => void
}

/**
 * `PATCH api/Account/Phone` — the self-service phone change (A4/A5).
 *
 * The country picker is the same `PhoneField` the sign-up form uses, so the two cannot drift; it is
 * seeded from the stored number (which pins the country, so the geo-IP default never overrides an
 * existing value) and falls back to geo-IP for an account that has no number yet.
 *
 * On success the store is updated through `applyUser` rather than by reloading: the header and this
 * screen both read the same snapshot, and `applyUser` is the one path that preserves `isSuperAdmin`
 * across a `UserInfoModel`-shaped update (ADR 011, write site 4).
 */
export function PhoneChangeForm({ currentPhone, onSaved }: PhoneChangeFormProps) {
  const { t } = useLocale()
  const defaultCountry = useDefaultPhoneCountry()

  const initial = currentPhone ?? ''
  const [value, setValue] = useState(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    setPending(true)
    setError(null)
    try {
      const updated = await updatePhone(value)
      applyUser(toAuthUser(updated))
      setSaved(true)
      onSaved(updated)
    } catch (err) {
      setError(t(accountErrorMessageKey(err)))
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="flex flex-col gap-3.5" onSubmit={handleSubmit} noValidate>
      {error && <AuthError message={error} />}
      {saved && <AuthNotice message={t('account.phoneSaved')} />}

      <PhoneField
        name="phoneNumber"
        label={t('auth.phone')}
        defaultCountry={defaultCountry}
        initialValue={initial}
        disabled={pending}
        onValueChange={(next) => {
          setValue(next)
          // A fresh edit invalidates the previous confirmation — leaving "saved" on screen while
          // the field says something else would be a lie.
          setSaved(false)
        }}
      />

      {/* Unchanged value → nothing to send. An EMPTY value is a legitimate submit ("remove my
          number", the column is nullable since B1), so this compares against the original rather
          than testing for emptiness. */}
      <AuthSubmitButton disabled={pending || value === initial}>
        {pending ? t('auth.submitting') : t('account.phoneSubmit')}
      </AuthSubmitButton>
    </form>
  )
}
