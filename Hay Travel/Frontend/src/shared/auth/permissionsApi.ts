/**
 * `api/Auth/MyPermissions` — the one endpoint the permission store itself calls.
 *
 * Goes through `apiFetch`, deliberately NOT through `authFetch`: `authFetch` depends on
 * `authStore`, and `authStore` depends on `permissionStore`, so importing `authFetch` here would
 * close the cycle (ADR 024, decision 3). The bearer token still travels — `authStore` registers
 * `setAuthTokenProvider` with `shared/lib/http`, and `apiFetch` attaches it opportunistically.
 *
 * `authFetch`'s extras are not needed here either: this call is only ever made right after a token
 * was issued, so neither the proactive refresh nor the 401-retry would have anything to do.
 *
 * Throws `ApiError` (401 / 403 / network) — the store decides what that means.
 */

import { apiFetch } from '@/shared/lib/http'
import type { MyPermissionsModel } from './types'

export function fetchMyPermissions(): Promise<MyPermissionsModel> {
  return apiFetch<MyPermissionsModel>('api/Auth/MyPermissions')
}
