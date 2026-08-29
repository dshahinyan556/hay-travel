import type { ReactNode } from 'react'
import { RoleType, type UserDetailInfoModel } from '@/shared/auth'
import { Card, Select } from '@/shared/ui'
import { countryFromPhone } from '@/shared/lib/phoneCountry'
import { countryDisplayName } from '@/shared/lib/country'
import type { Locale } from '@/shared/lib/locale'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { useCopy } from '@/shared/i18n/defineCopy'
import type { EmployeeJobRole } from '@/shared/types/employeeRole'
import { LanguageCode } from '@/features/admin/lib/enums'
import { adminEnumsCopy } from '@/features/admin/lib/adminEnumsCopy'
import { EmployeeJobRoleSelect } from '@/features/admin/ui/EmployeeJobRoleSelect'
import { userCopy } from '../lib/userCopy'

interface UserDetailInfoProps {
  user: UserDetailInfoModel
  /** Задача D — the assignment popup's default. Only shown for `RoleType.Employee` accounts,
   * where it's actually meaningful; the field itself has no such restriction server-side. */
  onChangeJobRole: (role: EmployeeJobRole | null) => void
  jobRolePending: boolean
  /** Язык писем (редизайн 2026-08-23). Unlike the job role this is shown for EVERY account: emails
   * go to clients and admins just as much as to employees. Non-nullable — there is no "clear". */
  onChangePreferredLanguage: (language: LanguageCode) => void
  languagePending: boolean
  /** `users.Update`, already narrowed by the page's SuperAdmin lock (`canEditUser`, 2026-08-27) —
   * a capability, resolved once by the container, never a permission lookup in here. The row stays
   * VISIBLE without it (it is information, not just a control) and the picker is merely disabled —
   * the practice `UserDangerZone` already follows. */
  canUpdate: boolean
}

/** Fixed option order — captions are resolved per render from `adminEnumsCopy`, same split as in
 * `EmployeeJobRoleSelect`. */
const LANGUAGE_ORDER = [LanguageCode.Russian, LanguageCode.English]

/** `Select` speaks strings; parse back exhaustively instead of casting, so an unexpected value
 * degrades to "unchanged" rather than being asserted into the type (`parseJobRole`'s convention). */
function parseLanguage(value: string): LanguageCode | null {
  if (value === String(LanguageCode.Russian)) return LanguageCode.Russian
  if (value === String(LanguageCode.English)) return LanguageCode.English
  return null
}

/** One formatter per interface locale, built once — `Intl.DateTimeFormat` is not free to construct.
 * `en-GB` per Spec 009 §5 (day-month-year). The country name comes from `shared/lib/country`, which
 * caches its own `Intl.DisplayNames` per locale. */
const DATE: Record<Locale, Intl.DateTimeFormat> = {
  ru: new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long' }),
  en: new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }),
}

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
export function UserDetailInfo({
  user,
  onChangeJobRole,
  jobRolePending,
  onChangePreferredLanguage,
  languagePending,
  canUpdate,
}: UserDetailInfoProps) {
  const { locale } = useLocale()
  const copy = useCopy(userCopy)
  const languageLabels = useCopy(adminEnumsCopy).languageCode
  const country = countryFromPhone(user.phoneNumber)

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-4">
        <Card padding="sm">
          <h3 className="mb-1 text-sm font-semibold text-neutral-800">{copy.info.contacts}</h3>
          <div className="divide-y divide-neutral-100">
            <InfoRow label={copy.info.email} value={user.email} />
            <InfoRow label={copy.info.phone} value={user.phoneNumber || EMPTY} mono />
            <InfoRow label={copy.info.username} value={user.username} />
          </div>
        </Card>

        <Card padding="sm">
          <h3 className="mb-1 text-sm font-semibold text-neutral-800">{copy.info.account}</h3>
          <div className="divide-y divide-neutral-100">
            <InfoRow
              label={copy.info.registeredAt}
              value={DATE[locale].format(new Date(user.registeredAtUtc))}
            />
            {/* `roleName` from the server, not `roleLabels[user.role]`: a user-created role has no
                `RoleType` to look up, and its name is the only caption that exists. */}
            <InfoRow label={copy.info.role} value={user.roleName} />
            {/* Роль исполнителя по умолчанию (Задача D) — только для аккаунтов «Исполнитель»: для
                любой другой роли поле не несёт смысла, хотя бэкенд не запрещает его иметь. Меняется
                сразу, без отдельной кнопки Save — тот же паттерн, что и у RoleSelect в таблице. */}
            {user.role === RoleType.Employee && (
              <div className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
                <span className="text-neutral-500">{copy.info.defaultJobRole}</span>
                <EmployeeJobRoleSelect
                  value={user.defaultJobRole}
                  onChange={onChangeJobRole}
                  disabled={jobRolePending || !canUpdate}
                  allowClear
                  className="w-44"
                  aria-label={copy.info.defaultJobRoleAria}
                />
              </div>
            )}
            {/* Язык писем (редизайн 2026-08-23) — по нему notification-сервис выбирает языковую
                версию шаблона. Без ограничения по роли, в отличие от строки выше: письма получают
                и клиенты, и администраторы. Сохраняется сразу, без отдельной кнопки Save. */}
            <div className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
              <span className="text-neutral-500">{copy.info.preferredLanguage}</span>
              <Select
                surface="admin"
                value={String(user.preferredLanguage)}
                onChange={(next) => {
                  const language = parseLanguage(next)
                  if (language !== null) onChangePreferredLanguage(language)
                }}
                options={LANGUAGE_ORDER.map((language) => ({
                  value: String(language),
                  label: languageLabels[language],
                }))}
                disabled={languagePending || !canUpdate}
                className="w-44"
                aria-label={copy.info.preferredLanguageAria}
              />
            </div>
          </div>
        </Card>
      </div>

      <Card padding="sm" className="self-start">
        <h3 className="mb-1 text-sm font-semibold text-neutral-800">{copy.info.session}</h3>
        <div className="divide-y divide-neutral-100">
          <InfoRow label={copy.info.registeredIp} value={user.registeredIp || EMPTY} mono />
          <InfoRow label={copy.info.lastLoginIp} value={user.lastLoginIp || EMPTY} mono />
          <InfoRow
            label={copy.info.country}
            value={
              country ? (
                <span>
                  <span aria-hidden="true">{country.flag}</span>{' '}
                  {countryDisplayName(country.iso2, locale)}
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
