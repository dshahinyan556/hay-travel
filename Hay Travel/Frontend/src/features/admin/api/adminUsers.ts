/**
 * Admin Users API — `api/Users`, `[Authorize(Roles = "Admin")]` on the whole controller, so
 * every call here 403s for a TourManager. Mirrored client-side by `canManageUsers`.
 */

import {
  authFetch,
  type ChangeRoleRequest,
  type LoginHistoryEntryModel,
  type UserDetailInfoModel,
  type UserInfoModel,
} from '@/shared/auth'

/** GET every account. Small list by design — no paging on the backend. */
export function getUsers(): Promise<UserInfoModel[]> {
  return authFetch<UserInfoModel[]>('api/Users')
}

/**
 * GET one account's detail (B13) — IP/activity/registration fields the list never carries. 404s
 * as `ApiError` (`RelationalEntityNotFound`) for a missing or already soft-deleted id; the caller
 * (`userDetailLoader`) does not catch this, it propagates to `AdminErrorBoundary` like every other
 * admin loader failure.
 */
export function getUserDetail(id: number): Promise<UserDetailInfoModel> {
  return authFetch<UserDetailInfoModel>(`api/Users/${id}`)
}

/**
 * GET one account's login history (C2, 2026-08-09) — newest first, capped at 100 rows server-side.
 *
 * Written on every successful `Login` only; a token refresh is not a login and is not recorded. The
 * caller (`userDetailLoader`) catches failures on this ONE request so a broken history endpoint
 * cannot take the whole profile card down with it.
 */
export function getUserLoginHistory(id: number): Promise<LoginHistoryEntryModel[]> {
  return authFetch<LoginHistoryEntryModel[]>(`api/Users/${id}/LoginHistory`)
}

/**
 * Soft-delete (B4) — Admin-only, rejects deleting your own account with `ApiError` carrying
 * `errorCode: CannotDeleteSelf` (2212). The UI additionally hides the action on your own profile
 * (`UserDangerZone`'s `canDelete`), so reaching this code from the panel would mean a stale page.
 */
export function deleteUser(id: number): Promise<void> {
  return authFetch<void>(`api/Users/Delete?id=${id}`, { method: 'DELETE' })
}

/** Sets `ForceToChangePass = true` and returns the updated account (B5) — no second GET needed. */
export function forcePasswordReset(id: number): Promise<UserInfoModel> {
  return authFetch<UserInfoModel>(`api/Users/ForcePasswordReset?id=${id}`, { method: 'POST' })
}

/**
 * PATCH one account's role; returns the updated row so the caller can replace it in place.
 *
 * `roleId` is the `UserRole` primary key, NOT the `RoleType` tier — see `UserInfoModel`.
 *
 * As of B6 (2026-08-06) the backend rejects with `ApiError` carrying `errorCode:
 * AdminRoleImmutable` (2214, 403) whenever the TARGET's CURRENT role is Admin, unconditionally —
 * this replaced the older two-message guard (self / "last remaining admin") that used to answer
 * `InvalidEntityRelation` (2001); that code path was deleted server-side, it no longer occurs for
 * this endpoint. The UI blocks the reachable case up front (`RoleSelect` is disabled both on your
 * own row and on any row whose current role is Admin, see F5/`UsersTable`'s `isTargetAdmin`) —
 * 2214 from here in practice means the row was stale (someone else changed it moments ago).
 */
export function changeUserRole(request: ChangeRoleRequest): Promise<UserInfoModel> {
  return authFetch<UserInfoModel>('api/Users/ChangeRole', {
    method: 'PATCH',
    body: JSON.stringify(request),
  })
}
