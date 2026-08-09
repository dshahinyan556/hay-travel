/**
 * Country presentation helpers — flag emoji and localised country name from an ISO 3166-1 alpha-2
 * code.
 *
 * Separate from `phoneCountry.ts` on purpose: that module is about PHONE numbers (calling codes,
 * parsing) and depends on `libphonenumber-js`; this one is pure presentation with no dependency at
 * all, so it can be imported by anything (including `phoneCountry.ts` itself, which is why the
 * direction is one-way: `country.ts` imports nothing).
 *
 * Both consumers today are the public site and the admin panel, which is exactly why neither
 * feature owns this.
 */

/**
 * Regional-indicator emoji flag from an ISO 3166-1 alpha-2 code (`'AM'` → `'🇦🇲'`).
 *
 * NOTE the same constraint `phoneCountry.ts` documents: emoji are an ADMIN-panel icon language.
 * The public site renders SVG flags (`country-flag-icons`) instead — see `useCountryOptions`.
 */
export function countryFlagEmoji(iso2: string): string {
  const code = iso2.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return ''
  return code.replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
}

/**
 * `Intl.DisplayNames` is not free to construct (it builds a locale-data table), and the country
 * picker asks for ~250 names in one render — so one instance per locale is cached here rather than
 * re-created per call.
 */
const displayNamesByLocale = new Map<string, Intl.DisplayNames>()

function displayNamesFor(locale: string): Intl.DisplayNames | null {
  const cached = displayNamesByLocale.get(locale)
  if (cached) return cached
  try {
    const instance = new Intl.DisplayNames([locale], { type: 'region' })
    displayNamesByLocale.set(locale, instance)
    return instance
  } catch {
    // An unsupported locale tag would throw; the caller falls back to the raw code, which is still
    // recognisable ("AM"), rather than rendering nothing.
    return null
  }
}

/**
 * Localised country name (`('AM', 'ru')` → `'Армения'`). Falls back to the uppercased code for
 * codes the runtime does not know (user-assigned ranges, or a stale ISO code).
 */
export function countryDisplayName(iso2: string, locale: string): string {
  const code = iso2.trim().toUpperCase()
  const names = displayNamesFor(locale)
  if (!names) return code
  try {
    return names.of(code) ?? code
  } catch {
    return code
  }
}
