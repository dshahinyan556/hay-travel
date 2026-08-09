/**
 * Composite phone control: an explicit country picker on the left, the visitor's own digits on the
 * right, one hidden input posting the combined value.
 *
 * ── Why this was rewritten (A7, 2026-08-09) ───────────────────────────────────────────────────
 * The previous version had NO country picker at all: it guessed. It assumed Armenia, and only
 * switched away once the typed digits formed a complete valid number for some other country. The
 * complaint that produced this rewrite was exactly that — a foreign visitor typing their own
 * national number had it silently read as Armenian, with no way to say otherwise. The guess is
 * gone; the selected country is now authoritative, and geo-IP only supplies its INITIAL value.
 *
 * ── The one rule that must not be broken ──────────────────────────────────────────────────────
 * `defaultCountry` (which arrives late, from geo-IP) may only move the selection while the visitor
 * has neither picked a country themselves NOR typed a digit — i.e. `picked === null && digits ===
 * ''`. The moment either happens, the country is latched. Without this the flag would jump under
 * the user's finger the instant the geo request resolves, which is worse than any default.
 *
 * ── What gets posted ──────────────────────────────────────────────────────────────────────────
 * `dialCode.slice(1) + digits` — the calling code WITHOUT a leading `+`, which is the format the
 * backend column has always stored (`User.PhoneNumber`, nvarchar(15)); this rewrite does not change
 * the wire format. Empty digits post an empty string, so "no phone" stays representable.
 *
 * ── Uncontrolled elsewhere, controlled here ───────────────────────────────────────────────────
 * The rest of the auth forms are uncontrolled (`AuthField`'s doc comment). This field is not: the
 * dial code and the validity hint have to re-render as the visitor types. Only this field
 * re-renders per keystroke; the surrounding form does not.
 */

import { useId, useState } from 'react'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { countryByIso2, DEFAULT_PHONE_COUNTRY, type PhoneCountry } from '@/shared/lib/phoneCountry'
import { HelpButton } from '@/shared/ui/HelpButton'
import { CountrySelect } from './CountrySelect'

/** E.164 ceiling — mirrors the backend's `PhoneNumber(15)` column (see B1 in the checklist). */
const MAX_DIGITS = 15

interface PhoneFieldProps {
  /** `FormData` key the hidden input posts under. */
  name: string
  label: string
  /**
   * Country to start on — normally `useDefaultPhoneCountry()` (geo-IP, arrives late). Only honoured
   * while the visitor has not picked a country and has not typed anything; see the module comment.
   */
  defaultCountry?: PhoneCountry
  /**
   * An existing stored number in the backend's format (calling code, no leading `+`), e.g.
   * `'37455123456'`. Read ONCE, to seed both the country and the digits; later changes to this prop
   * are ignored, because the field is the visitor's working copy from then on.
   */
  initialValue?: string
  /** Defaults to `false` — the sign-up form has always allowed an empty phone (F2). */
  required?: boolean
  disabled?: boolean
  /** Fires with the value that WOULD be posted, for callers that need to enable/disable a save
   * button (the account screen does; the sign-up form reads `FormData` at submit instead). */
  onValueChange?: (value: string) => void
}

/** Split a stored `<calling code><national>` string into a country and its national digits. */
function seedFromValue(initialValue: string | undefined): {
  country: PhoneCountry | null
  digits: string
} {
  const digits = (initialValue ?? '').replace(/\D/g, '')
  if (!digits) return { country: null, digits: '' }

  const parsed = parsePhoneNumberFromString(`+${digits}`)
  const country = parsed?.country ? countryByIso2(parsed.country) : null
  // Unparseable stored value (legacy row, a number the metadata does not cover): show it verbatim
  // in the input rather than dropping data the visitor might want to correct.
  if (!country || !parsed) return { country: null, digits: digits.slice(0, MAX_DIGITS) }

  return { country, digits: parsed.nationalNumber.slice(0, MAX_DIGITS) }
}

export function PhoneField({
  name,
  label,
  defaultCountry,
  initialValue,
  required = false,
  disabled = false,
  onValueChange,
}: PhoneFieldProps) {
  const { t } = useLocale()

  // Computed once, on mount — `initialValue` is a seed, not a controlled value (see the prop's doc).
  const [seed] = useState(() => seedFromValue(initialValue))
  /** Non-null once the country stops following `defaultCountry` — because the visitor chose one,
   * typed a digit, or because `initialValue` already told us which country this is. */
  const [picked, setPicked] = useState<PhoneCountry | null>(seed.country)
  const [digits, setDigits] = useState(seed.digits)
  const [touched, setTouched] = useState(false)

  const inputId = useId()
  const errorId = `${name}-error`

  const country = picked ?? defaultCountry ?? DEFAULT_PHONE_COUNTRY
  const composed = digits ? `${country.dialCode.slice(1)}${digits}` : ''

  // `isValid()` against the SELECTED country — not the lenient prefix lookup in
  // `shared/lib/phoneCountry`, which is right for a stored number and wrong for one being typed.
  const isComplete = digits === '' || parsePhoneNumberFromString(digits, country.iso2)?.isValid() === true
  const showError = touched && !isComplete

  function commit(nextCountry: PhoneCountry, nextDigits: string) {
    setPicked(nextCountry)
    setDigits(nextDigits)
    onValueChange?.(nextDigits ? `${nextCountry.dialCode.slice(1)}${nextDigits}` : '')
  }

  function handleCountryChange(iso2: string) {
    const next = countryByIso2(iso2)
    if (next) commit(next, digits)
  }

  function handleInput(raw: string) {
    const trimmed = raw.trim()

    // The one remaining piece of inference, and it only fires on an explicitly international
    // string: someone pasting "+374 55 12 34 56" means the country too, not just the digits. It
    // never runs during ordinary typing, so it cannot flip the flag mid-entry.
    if (trimmed.startsWith('+')) {
      const parsed = parsePhoneNumberFromString(trimmed)
      const detected = parsed?.country ? countryByIso2(parsed.country) : null
      if (parsed && detected) {
        commit(detected, parsed.nationalNumber.slice(0, MAX_DIGITS))
        return
      }
    }

    const nextDigits = trimmed.replace(/\D/g, '').slice(0, MAX_DIGITS)
    // Typing latches the country: from here on, a late geo-IP answer must not move it.
    commit(picked ?? country, nextDigits)
  }

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

      {/* Two separate controls in a row rather than one welded box: the picker is a real
          `Select` with its own popover/sheet, and nesting its chrome inside another bordered
          container would draw the box twice. `min-w-0` on the number half is what keeps the row
          from overflowing at 375px. */}
      <div className="flex items-start gap-2">
        <CountrySelect
          value={country.iso2}
          onChange={handleCountryChange}
          disabled={disabled}
          ariaLabel={t('auth.countrySelectLabel')}
          className="w-[7.25rem] shrink-0"
        />

        <div
          className={`group flex h-[46px] min-w-0 flex-1 items-center rounded-xl bg-panel-raised ring-1 transition-colors duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)] focus-within:ring-2 focus-within:ring-focus ${
            showError ? 'ring-danger' : 'ring-edge-strong hover:ring-gold-line'
          } ${disabled ? 'opacity-60' : ''}`}
        >
          <input
            id={inputId}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            required={required}
            disabled={disabled}
            // Generous on purpose: the VALUE is capped at `MAX_DIGITS` in `handleInput`, but a
            // pasted, formatted international number ("+374 55 12 34 56") must be allowed to land
            // in the field long enough for the paste branch to read the country out of it.
            maxLength={MAX_DIGITS + 9}
            value={digits}
            placeholder={t('auth.phonePlaceholder')}
            onChange={(event) => handleInput(event.currentTarget.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={showError || undefined}
            aria-describedby={showError ? errorId : undefined}
            className="min-w-0 flex-1 bg-transparent px-3.5 text-sm text-ink outline-none placeholder:text-ink-muted"
          />
        </div>
      </div>

      {showError && (
        <span id={errorId} className="mt-1 block text-xs text-danger">
          {t('auth.phoneIncomplete')}
        </span>
      )}

      <input type="hidden" name={name} value={composed} />
    </div>
  )
}
