/**
 * Composite phone control for the registration form (F2, 2026-08-06 design pass): a read-only
 * "code + flag" chip on the left, the visitor's own digits on the right.
 *
 * NOT required (see `RegisterForm`/`RegisterRequest` — the backend's `PhoneNumber` column is
 * still non-nullable until B1 lands, but this field posts whatever the visitor typed, including
 * nothing at all; the server is the one that will reject an empty value today, surfaced through
 * the existing form-level `AuthError`).
 *
 * Uncontrolled everywhere else in this form on purpose (see `AuthField`'s doc comment) — this
 * field breaks that pattern deliberately: the flag/dial-code chip has to re-render live as the
 * visitor types, which needs the raw digits in React state. The rest of the form is unaffected
 * (this is the only field that re-renders per keystroke).
 *
 * ── How the chip decides the country ──────────────────────────────────────────────────────────
 * `shared/lib/phoneCountry.ts::countryFromPhone` is deliberately lenient (any recognisable prefix
 * counts) — right for a stored, complete number, wrong for a number that's still mid-typing: an
 * Armenian mobile number typed as just "55…" would misread as Brazil's `+55` calling code well
 * before the visitor is done. So this field runs its own two-step policy on top of the shared
 * function, using `libphonenumber-js`'s stricter `isValid()` to decide WHICH string to feed it:
 *   1. Assume the site's default market (Armenia) — try `+374` + whatever was typed.
 *   2. Only switch away from Armenia once the digits typed ALONE already form a complete, valid
 *      number for a different country (a diaspora visitor or a guest pasting their own
 *      international number) — never on a partial prefix match.
 * Neither step duplicates the shared country-lookup itself; they only decide which candidate
 * string is worth asking it about.
 *
 * The visible input always shows exactly what the visitor typed, unstripped and unformatted
 * (deviates from the mockup's cosmetically spaced/stripped display — deliberate: reformatting a
 * controlled input while the user is mid-keystroke is a well-known source of cursor-jump bugs,
 * and this is the most visible page on the site). What's actually POSTed (the hidden field) is
 * composed to include the calling code either way, so the backend keeps receiving one consistent
 * shape regardless of which country the visitor was typing for.
 */

import { useId, useState } from 'react'
import type { ComponentType, SVGProps } from 'react'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import * as Flags from 'country-flag-icons/react/3x2'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { countryFromPhone } from '@/shared/lib/phoneCountry'
import type { PhoneCountry } from '@/shared/lib/phoneCountry'
import { HelpButton } from '@/shared/ui/HelpButton'

/** Every ISO alpha-2 flag `country-flag-icons` ships, keyed the same way `PhoneCountry.iso2` is. */
const FLAGS = Flags as unknown as Record<string, ComponentType<SVGProps<SVGSVGElement>>>

/** The site's own market — the default chip before the visitor has typed anything, and what's
 * assumed for whatever they type unless it resolves to a complete, valid number for some other
 * country on its own (see the module doc comment above). */
const DEFAULT_COUNTRY: PhoneCountry = { iso2: 'AM', flag: '🇦🇲', dialCode: '+374' }

/** E.164 ceiling — mirrors the backend's `PhoneNumber(15)` column (see B1 in the checklist). */
const MAX_DIGITS = 15

interface ResolvedEntry {
  country: PhoneCountry
  /** Digits to post — includes the calling code either way (see module doc comment). */
  composed: string
  /** True once there are digits typed that don't yet form a complete, valid number for either
   * the assumed default country or a confidently-detected other one. Drives the inline error. */
  incomplete: boolean
}

function resolveEntry(rawDigits: string): ResolvedEntry {
  if (!rawDigits) return { country: DEFAULT_COUNTRY, composed: '', incomplete: false }

  const amCandidate = DEFAULT_COUNTRY.dialCode.slice(1) + rawDigits
  const amNumber = parsePhoneNumberFromString(`+${amCandidate}`)
  if (amNumber?.isValid()) {
    return { country: DEFAULT_COUNTRY, composed: amCandidate, incomplete: false }
  }

  // Only reinterpret as a different country once the digits form a genuinely complete, valid
  // number ON THEIR OWN — a short prefix must never flip the chip mid-type.
  const intlNumber = parsePhoneNumberFromString(`+${rawDigits}`)
  if (intlNumber?.isValid()) {
    const detected = countryFromPhone(rawDigits)
    if (detected) return { country: detected, composed: rawDigits, incomplete: false }
  }

  return { country: DEFAULT_COUNTRY, composed: amCandidate, incomplete: true }
}

interface PhoneFieldProps {
  /** `FormData` key the hidden input posts under. */
  name: string
  label: string
}

export function PhoneField({ name, label }: PhoneFieldProps) {
  const { t } = useLocale()
  const [rawDigits, setRawDigits] = useState('')
  const [touched, setTouched] = useState(false)

  const inputId = useId()
  const errorId = `${name}-error`

  const { country, composed, incomplete } = resolveEntry(rawDigits)
  const showError = touched && incomplete
  const Flag = FLAGS[country.iso2]

  return (
    <div className="block">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-[11px] font-semibold tracking-[.14em] text-ink-muted uppercase">
          {label}
        </label>
        <HelpButton title={t('auth.phoneHelpTitle')} triggerLabel={t('auth.phoneHelpAria')}>
          {t('auth.phoneHelpBody')}
        </HelpButton>
      </div>

      <div
        className={`group flex h-[46px] items-stretch overflow-hidden rounded-xl bg-panel-raised ring-1 transition-colors duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)] focus-within:ring-2 focus-within:ring-focus ${
          showError ? 'ring-danger' : 'ring-edge-strong hover:ring-gold-line'
        }`}
      >
        <span
          aria-hidden="true"
          className="flex shrink-0 items-center gap-1.5 border-r border-edge-strong bg-gold-soft px-2.5 text-sm font-semibold whitespace-nowrap text-ink-dim"
        >
          {Flag ? (
            <Flag className="h-[13px] w-[18px] shrink-0 rounded-[2px]" />
          ) : (
            <span className="h-[13px] w-[18px] shrink-0 rounded-[2px] bg-edge-strong" />
          )}
          {country.dialCode}
        </span>
        <input
          id={inputId}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={MAX_DIGITS}
          value={rawDigits}
          placeholder={t('auth.phonePlaceholder')}
          onChange={(event) => setRawDigits(event.currentTarget.value.replace(/\D/g, '').slice(0, MAX_DIGITS))}
          onBlur={() => setTouched(true)}
          aria-invalid={showError || undefined}
          aria-describedby={showError ? errorId : undefined}
          className="min-w-0 flex-1 bg-transparent px-3.5 text-sm text-ink outline-none placeholder:text-ink-muted"
        />
      </div>

      {showError && (
        <span id={errorId} className="mt-1 block text-xs text-danger">
          {t('auth.phoneIncomplete')}
        </span>
      )}

      {/* Not `required` on purpose (F2) — the field posts whatever's here, including nothing. */}
      <input type="hidden" name={name} value={composed} />
    </div>
  )
}
