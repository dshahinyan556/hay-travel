/**
 * The country list for `CountrySelect`, as `shared/ui/Select` options.
 *
 * Built from `PHONE_COUNTRIES` (a static module constant — see `shared/lib/phoneCountry.ts`) and
 * memoised per locale: ~250 `Intl.DisplayNames` lookups plus a locale-aware sort is not something
 * to redo on every keystroke of the phone field next to it.
 *
 * Flags are SVG (`country-flag-icons`), never the emoji `PhoneCountry.flag` carries: emoji are the
 * ADMIN panel's icon language and are banned as UI elements on the public site (see the note in
 * `shared/lib/phoneCountry.ts` and `client-site.md`).
 *
 * `createElement` rather than JSX so this stays a plain `.ts` module — the flag is one element with
 * no markup around it, and the file is a hook, not a component.
 */

import { createElement, useMemo } from 'react'
import type { ComponentType, ReactNode, SVGProps } from 'react'
import * as Flags from 'country-flag-icons/react/3x2'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { countryDisplayName } from '@/shared/lib/country'
import { PHONE_COUNTRIES } from '@/shared/lib/phoneCountry'
import type { SelectOption } from '@/shared/ui'

/** Every ISO alpha-2 flag `country-flag-icons` ships, keyed the same way `PhoneCountry.iso2` is. */
const FLAGS = Flags as unknown as Record<string, ComponentType<SVGProps<SVGSVGElement>>>

const FLAG_CLASS = 'h-[13px] w-[18px] shrink-0 rounded-[2px]'

/**
 * Flag glyph for one country, or a neutral placeholder block of the same size so rows never lose
 * their alignment for a code the icon set does not cover.
 */
export function countryFlagNode(iso2: string): ReactNode {
  const Flag = FLAGS[iso2]
  if (!Flag) return createElement('span', { className: `${FLAG_CLASS} bg-edge-strong` })
  return createElement(Flag, { className: FLAG_CLASS })
}

export function useCountryOptions(): SelectOption[] {
  const { locale } = useLocale()

  return useMemo(() => {
    const collator = new Intl.Collator(locale)
    return PHONE_COUNTRIES.map((country) => ({
      value: country.iso2,
      // Both the name and the dial code are in the LABEL, because the label is what the search box
      // filters on — a visitor who only knows "+374" must be able to find Armenia by typing it.
      label: `${countryDisplayName(country.iso2, locale)} ${country.dialCode}`,
      // The trigger is a narrow chip next to the number input: the dial code is the only part that
      // fits there, and the flag beside it already identifies the country.
      triggerLabel: country.dialCode,
      icon: countryFlagNode(country.iso2),
    })).sort((a, b) => collator.compare(a.label, b.label))
  }, [locale])
}
