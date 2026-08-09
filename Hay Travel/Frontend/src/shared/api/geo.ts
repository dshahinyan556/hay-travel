/**
 * `GET api/Geo/Country` — the visitor's country/city, resolved server-side from the request IP
 * (B2, 2026-08-09). Anonymous by design: the sign-up form needs it before an account exists, so it
 * goes through `apiFetch`, not `authFetch`.
 *
 * The response carries NO dial code on purpose (see `GeoController`): calling codes live in
 * `libphonenumber-js` on the client, and duplicating that table server-side would be a second
 * source of truth. Callers map `countryCode` through `shared/lib/phoneCountry.countryByIso2`.
 *
 * ── Why the module-level cache ────────────────────────────────────────────────────────────────
 * The answer cannot change while the page is open (it is a property of the connection, not of the
 * session), and two different forms can mount phone fields in the same visit. So the promise is
 * memoised for the lifetime of the page: N callers share ONE request, and a later caller gets the
 * cached answer with no request at all.
 *
 * A FAILURE is cached too, deliberately: the geo database is optional on the backend and may be
 * absent for the whole deployment. Retrying on every field mount would turn "no geo data" into a
 * request storm for a purely cosmetic default.
 */

import { apiFetch } from '@/shared/lib/http'

/** Every field is nullable: the backend answers 200 with empty fields when the address is not in
 * the database, which is a normal answer ("pick your own default"), not an error. */
export interface IpCountryModel {
  countryCode: string | null
  countryName: string | null
  city: string | null
}

let pending: Promise<IpCountryModel | null> | null = null

/** Resolves to the visitor's location, or `null` when it could not be determined (offline, the
 * backend has no geo database, the IP is private/unknown). Never rejects. */
export function getVisitorCountry(): Promise<IpCountryModel | null> {
  pending ??= apiFetch<IpCountryModel>('api/Geo/Country').catch(() => null)
  return pending
}
