/**
 * `api/Account` — the self-service half of the auth surface (A4/A5, 2026-08-09).
 *
 * Deliberately NOT in `shared/auth/authApi.ts`: that module is what the store is built on, so it
 * must not reach back into `authFetch` (which depends on the store). Feature-local API modules keep
 * that chain acyclic — same reasoning, and same shape, as `features/auth/api/changePassword.ts`.
 *
 * Both endpoints derive the user id from the bearer token and take no id parameter, so there is no
 * IDOR surface here at all — that is why they exist separately from the Admin-only `api/Users/{id}`.
 */

import { authFetch, type UserInfoModel } from '@/shared/auth'

/**
 * `GET api/Account/Me` — the signed-in user's own profile.
 *
 * Needed because `AuthUser` is rebuilt from JWT claims after a reload (ADR 007) and the token
 * carries no first/last name and no phone number; `/account` has to show both (ADR 010's "open
 * question", since resolved by the backend adding this endpoint).
 */
export function getMe(): Promise<UserInfoModel> {
  return authFetch<UserInfoModel>('api/Account/Me')
}

/**
 * `PATCH api/Account/Phone` — replace your own phone number; returns the updated profile so the
 * caller can push it into the store without a second GET.
 *
 * An empty string is a legitimate value ("remove my number"): the column has been nullable since
 * B1. The number is sent in the backend's stored format — calling code, NO leading `+` — which is
 * exactly what `PhoneField` composes.
 */
export function updatePhone(phoneNumber: string): Promise<UserInfoModel> {
  return authFetch<UserInfoModel>('api/Account/Phone', {
    method: 'PATCH',
    body: JSON.stringify({ phoneNumber }),
  })
}
