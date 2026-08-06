import type { ReactNode } from 'react'
import type { UserDetailInfoModel } from '@/shared/auth'
import { Card } from '@/shared/ui'
import { countryFromPhone } from '@/shared/lib/phoneCountry'
import { roleLabels } from '../lib/userCopy'

interface UserDetailInfoProps {
  user: UserDetailInfoModel
}

const dateFormatter = new Intl.DateTimeFormat('ru', { dateStyle: 'long' })
/** RU country names from an ISO 3166-1 alpha-2 code — a browser built-in, no extra dependency on
 * top of `libphonenumber-js` (which only resolves the code, not a display name). */
const countryNames = new Intl.DisplayNames(['ru'], { type: 'region' })

const EMPTY = <span className="text-neutral-400">—</span>

function InfoRow({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-neutral-500">{label}</span>
      <span className={`text-right font-medium text-neutral-900 ${mono ? 'font-mono tabular-nums' : ''}`}>
        {value}
      </span>
    </div>
  )
}

/**
 * Read-only data grid for the user-detail screen (F4): contacts, account/registration, and
 * session/geolocation — three `Card`s, matching the mockup's grouping. Country + flag are derived
 * client-side from the stored phone number (`shared/lib/phoneCountry.ts`, shared with F2) — the
 * backend does not send country/city (B13's contract is IP/activity/registration only), so there
 * is no "Город" row here: the mockup's city field was explicitly marked "если доступно" and there
 * is no data source for it at all, fabricating one would not be honest to what's actually shown.
 */
export function UserDetailInfo({ user }: UserDetailInfoProps) {
  const country = countryFromPhone(user.phoneNumber)

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-4">
        <Card padding="sm">
          <h3 className="mb-1 text-sm font-semibold text-neutral-800">Контакты</h3>
          <div className="divide-y divide-neutral-100">
            <InfoRow label="Email" value={user.email} />
            <InfoRow label="Телефон" value={user.phoneNumber || EMPTY} mono />
            <InfoRow label="Логин" value={user.username} />
          </div>
        </Card>

        <Card padding="sm">
          <h3 className="mb-1 text-sm font-semibold text-neutral-800">Аккаунт</h3>
          <div className="divide-y divide-neutral-100">
            <InfoRow label="Дата регистрации" value={dateFormatter.format(new Date(user.registeredAtUtc))} />
            <InfoRow label="Роль" value={roleLabels[user.role]} />
          </div>
        </Card>
      </div>

      <Card padding="sm" className="self-start">
        <h3 className="mb-1 text-sm font-semibold text-neutral-800">Сессия и геолокация</h3>
        <div className="divide-y divide-neutral-100">
          <InfoRow label="IP регистрации" value={user.registeredIp || EMPTY} mono />
          <InfoRow label="IP последней активности" value={user.lastLoginIp || EMPTY} mono />
          <InfoRow
            label="Страна"
            value={
              country ? (
                <span>
                  <span aria-hidden="true">{country.flag}</span> {countryNames.of(country.iso2)}
                </span>
              ) : (
                EMPTY
              )
            }
          />
        </div>
      </Card>
    </div>
  )
}
