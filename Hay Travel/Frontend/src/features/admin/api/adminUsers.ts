/**
 * Admin Users API — `api/Users`, `[Authorize(Roles = "Admin")]` on the whole controller, so
 * every call here 403s for a TourManager. Mirrored client-side by `canManageUsers`.
 */

import { authFetch, type ChangeRoleRequest, type UserInfoModel } from '@/shared/auth'

/** GET every account. Small list by design — no paging on the backend. */
export function getUsers(): Promise<UserInfoModel[]> {
  return authFetch<UserInfoModel[]>('api/Users')
}

/**
 * PATCH one account's role; returns the updated row so the caller can replace it in place.
 *
 * `roleId` is the `UserRole` primary key, NOT the `RoleType` tier — see `UserInfoModel`.
 *
 * Rejects with `ApiError` carrying `errorCode: InvalidEntityRelation` (2001) for BOTH guards:
 * demoting yourself and demoting the last remaining admin. The two are indistinguishable by code,
 * which is why the UI blocks the self-demotion case up front (`RoleSelect` is disabled on your own
 * row) — that leaves 2001 meaning exactly one thing by the time a user can trigger it.
 */
export function changeUserRole(request: ChangeRoleRequest): Promise<UserInfoModel> {
  return authFetch<UserInfoModel>('api/Users/ChangeRole', {
    method: 'PATCH',
    body: JSON.stringify(request),
  })
}
