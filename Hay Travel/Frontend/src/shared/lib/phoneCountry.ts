import { AsYouType, getCountries, getCountryCallingCode } from 'libphonenumber-js'
import type { CountryCode } from 'libphonenumber-js'
import { countryFlagEmoji } from './country'

export interface PhoneCountry {
  /** ISO 3166-1 alpha-2 country code, e.g. `'AM'`. */
  iso2: CountryCode
  /**
   * Regional-indicator emoji flag, e.g. `'🇦🇲'`.
   *
   * Safe for the admin panel's own emoji-based icon language (🗄 ↩ 🔍 …). NOT for the public
   * site — emoji are banned there as UI elements (see `client-site.md` §Composition and the
   * design note in `admin-fixes-checklist-2026-08-06.txt` F1). Public-site callers should render
   * an SVG flag keyed off `iso2` instead (e.g. `country-flag-icons/react/3x2`) and ignore this
   * field.
   */
  flag: string
  /** E.164 calling code with the leading `+`, e.g. `'+374'`. */
  dialCode: string
}

/**
 * Determines the likely country of a phone number — complete or still mid-typing.
 *
 * Shared between `features/auth` (F2 — the phone field on sign-up, resolving the country as the
 * visitor types) and the future `features/admin/users` user-detail screen (F4 — country + flag
 * derived from a stored `phoneNumber`, since the backend does not send country/flag itself; see
 * `UserDetailInfo` in the architecture note, admin-fixes-checklist-2026-08-06.txt F2/F4). Neither
 * feature owns this logic — it lives here so the two never duplicate it or drift apart. Features
 * are not allowed to import from one another directly in this codebase; `shared/` is the only
 * legal meeting point.
 *
 * Deliberately lenient (prefix-based, via `AsYouType`) rather than requiring a fully valid
 * number: a caller that needs a stricter "is this actually a complete, valid number" check
 * (`features/auth`'s own typing heuristic does, to avoid e.g. an Armenian mobile number starting
 * "55…" being misread as Brazil's `+55` calling code mid-type) should call
 * `parsePhoneNumberFromString` from `libphonenumber-js` directly instead — that is a stricter
 * question this function is not trying to answer, and baking it in here would make the shared
 * contract auth-specific.
 *
 * Returns `null` for anything not confidently resolvable to one country — too short, ambiguous,
 * or not a phone number at all. Never treated as an error by callers: an unset or unrecognised
 * phone number is a normal state (the field is optional, see F1/B1).
 */
export function countryFromPhone(phone: string | null | undefined): PhoneCountry | null {
  if (!phone) return null
  const trimmed = phone.trim()
  if (!trimmed) return null

  const asYouType = new AsYouType()
  asYouType.input(trimmed.startsWith('+') ? trimmed : `+${trimmed}`)
  const country = asYouType.getCountry()
  if (!country) return null

  return entryFor(country)
}

/* -------------------------------------------------------------------------- */
/*  The full country table                                                     */
/* -------------------------------------------------------------------------- */

function entryFor(iso2: CountryCode): PhoneCountry {
  return { iso2, flag: countryFlagEmoji(iso2), dialCode: `+${getCountryCallingCode(iso2)}` }
}

/**
 * Every country `libphonenumber-js` knows a calling code for, built ONCE at module load.
 *
 * A module-level constant rather than a hook/memo: the list is ~250 entries and completely static
 * (it is derived from the bundled metadata, not from anything the user does), so rebuilding it per
 * mount of a phone field would be pure waste. The ORDER here is the library's own (alphabetical by
 * ISO code) — callers that show it to a human sort it by the LOCALISED name instead, which is a
 * per-locale concern and therefore not baked in here.
 */
export const PHONE_COUNTRIES: readonly PhoneCountry[] = getCountries().map(entryFor)

const BY_ISO2 = new Map<string, PhoneCountry>(
  PHONE_COUNTRIES.map((country) => [country.iso2, country]),
)

/** Look up one country by ISO 3166-1 alpha-2 code. `null` for anything not in the table — an
 * unknown code from geo-IP or a stored phone number is a normal, non-error state. */
export function countryByIso2(iso2: string | null | undefined): PhoneCountry | null {
  if (!iso2) return null
  return BY_ISO2.get(iso2.trim().toUpperCase()) ?? null
}

/**
 * The site's own market — what a phone field shows before geo-IP answers (or when it never does).
 *
 * Moved here from `features/auth/components/PhoneField` when the country picker became explicit:
 * two features now need the same fallback (sign-up and the account screen), and features may not
 * import from one another.
 */
export const DEFAULT_PHONE_COUNTRY: PhoneCountry =
  BY_ISO2.get('AM') ?? { iso2: 'AM' as CountryCode, flag: '🇦🇲', dialCode: '+374' }
