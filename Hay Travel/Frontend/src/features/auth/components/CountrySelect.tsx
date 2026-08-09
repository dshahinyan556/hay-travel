/**
 * The country half of `PhoneField` — a thin, opinionated wrapper over `shared/ui/Select`.
 *
 * It exists so the phone field does not have to know about option shapes, flags, locales or the
 * searchable-list configuration: it hands over an ISO code and gets one back. Two call sites today
 * (sign-up and the account screen) share it through `PhoneField`, so this stays inside
 * `features/auth` rather than being promoted to `shared/ui`.
 *
 * `searchable` is on because the list is ~250 entries: without a filter, picking a country on a
 * phone means scrolling a quarter of the world. The trigger shows only flag + dial code (via
 * `SelectOption.triggerLabel`) so the control still fits next to the number input at 375px.
 */

import type { CountryCode } from 'libphonenumber-js'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { Select } from '@/shared/ui'
import { useCountryOptions } from '../hooks/useCountryOptions'

interface CountrySelectProps {
  /** Currently selected ISO 3166-1 alpha-2 code. */
  value: CountryCode
  onChange: (iso2: CountryCode) => void
  disabled?: boolean
  /** Accessible name — the visible label belongs to the number input next to it. */
  ariaLabel: string
  /** Width/positioning of the wrapper, e.g. `w-[7.5rem] shrink-0`. */
  className?: string
}

export function CountrySelect({ value, onChange, disabled, ariaLabel, className }: CountrySelectProps) {
  const { t } = useLocale()
  const options = useCountryOptions()

  return (
    <Select
      surface="public"
      value={value}
      // `Select` speaks strings; every option's value came from `PHONE_COUNTRIES`, so anything
      // arriving here is a real ISO code — but the cast is confined to this one line rather than
      // spreading through the phone field.
      onChange={(next) => onChange(next as CountryCode)}
      options={options}
      disabled={disabled}
      searchable
      searchPlaceholder={t('auth.countrySearchPlaceholder')}
      noResultsText={t('auth.countryNoResults')}
      aria-label={ariaLabel}
      className={className}
      // Matches the 46px height and 12px radius of `AuthField`, so the two halves of the phone row
      // line up with every other field on the form.
      triggerClassName="h-[46px] rounded-xl px-2.5 py-2"
    />
  )
}
