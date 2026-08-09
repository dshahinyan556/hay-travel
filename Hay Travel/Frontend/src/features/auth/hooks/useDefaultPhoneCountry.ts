/**
 * Which country a phone field should PRE-SELECT for this visitor.
 *
 * Returns `DEFAULT_PHONE_COUNTRY` (Armenia, the site's own market) synchronously and swaps in the
 * geo-IP answer if and when it arrives — the form renders immediately either way. Blocking a
 * sign-up form on a best-effort lookup would be the wrong trade: the visitor can always pick the
 * country by hand, and `getVisitorCountry` never rejects.
 *
 * The request itself is de-duplicated and cached at module level in `shared/api/geo.ts`, so mounting
 * this hook in two forms costs one request per page load, not two.
 *
 * IMPORTANT for the consumer: this value is only a DEFAULT. `PhoneField` stops honouring it the
 * moment the visitor picks a country or types a digit — a flag that changes under the user's finger
 * mid-entry is the exact bug this whole feature exists to remove.
 */

import { useEffect, useState } from 'react'
import { getVisitorCountry } from '@/shared/api/geo'
import { countryByIso2, DEFAULT_PHONE_COUNTRY, type PhoneCountry } from '@/shared/lib/phoneCountry'

export function useDefaultPhoneCountry(): PhoneCountry {
  const [country, setCountry] = useState<PhoneCountry>(DEFAULT_PHONE_COUNTRY)

  useEffect(() => {
    let cancelled = false

    void getVisitorCountry().then((location) => {
      if (cancelled) return
      const resolved = countryByIso2(location?.countryCode)
      // No answer, or a country the phone-metadata table does not cover: keep the default rather
      // than clearing the field's country, which would leave it with no dial code at all.
      if (resolved) setCountry(resolved)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return country
}
