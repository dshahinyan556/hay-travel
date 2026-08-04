/**
 * `POST api/Auth/ChangePassword` — the only `api/Auth` endpoint that requires a bearer token.
 *
 * It lives here rather than in `shared/auth/authApi.ts` on purpose: `authApi` is what the store
 * is built on, so it must not reach back into `authFetch` (which depends on the store). Keeping
 * this one call next to the screen that makes it keeps that dependency chain acyclic.
 */

import { authFetch, type ChangePasswordRequest, type MessageResultModel } from '@/shared/auth'

/**
 * Rejects with `ApiError(401)` carrying `errorCode: InvalidCredentials` (2200) when the CURRENT
 * password is wrong. That is a domain failure, not an expired session — `authFetch` tells the two
 * apart by the presence of `errorCode`, so this does NOT trigger a refresh-and-retry and the form
 * can report "неверный пароль" instead of signing the user out.
 */
export function changePassword(request: ChangePasswordRequest): Promise<MessageResultModel> {
  return authFetch<MessageResultModel>('api/Auth/ChangePassword', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}
