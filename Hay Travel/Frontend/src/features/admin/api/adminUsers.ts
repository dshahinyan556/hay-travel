/**
 * Admin Users API — `api/Users`.
 *
 * Gated PER METHOD by the `users` permission key (`[RequiresPermission(AdminScreens.Users, …)]`),
 * not by a blanket `[Authorize(Roles = "Admin")]` any more: reads need `users.View`, role/job-role
 * changes and password resets need `users.Update`, deletion needs `users.Delete`. Mirrored
 * client-side by `canView/canUpdate/canDelete(AdminScreen.Users)`.
 *
 * The SuperAdmin guard inside `ChangeRole` sits ON TOP of that and is not part of the matrix
 * (ADR 011).
 */

import {
  authFetch,
  type ChangeRoleRequest,
  type LoginHistoryEntryModel,
  type LoginResultModel,
  type SetUserJobRoleModel,
  type SetUserPreferredLanguageModel,
  type UserDetailInfoModel,
  type UserInfoModel,
} from '@/shared/auth'
import type {
  ScreenOverrideModel,
  UserPermissionOverrideSaveModel,
} from '@/features/admin/types/roles'

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

/** PATCH `Users/SetJobRole` (Задача D) — sets/clears the profile's default job role, used to
 * pre-fill the assignment popup. `jobRole: null` is a valid "снять роль по умолчанию" — it does
 * not touch the mandatory role choice on the assignment itself. Returns the updated row. */
export function setUserJobRole(model: SetUserJobRoleModel): Promise<UserInfoModel> {
  return authFetch<UserInfoModel>('api/Users/SetJobRole', {
    method: 'PATCH',
    body: JSON.stringify(model),
  })
}

/**
 * PATCH `Users/SetPreferredLanguage` (редизайн 2026-08-23) — язык писем пользователя: по нему
 * notification-сервис выбирает языковую версию шаблона (`NotificationRecipientResolver`).
 *
 * Значение вне диапазона enum сервер НЕ отбивает ошибкой — оно падает в дефолт (`Russian`) с
 * warning'ом, поэтому у вызова нет «невалидного» исхода, кроме прав/сети. `users.Update`.
 * Returns the updated row.
 */
export function setUserPreferredLanguage(
  model: SetUserPreferredLanguageModel,
): Promise<UserInfoModel> {
  return authFetch<UserInfoModel>('api/Users/SetPreferredLanguage', {
    method: 'PATCH',
    body: JSON.stringify(model),
  })
}

/**
 * «Войти как пользователь» (spec 014 §3) — POST `api/Users/{id}/Impersonate`.
 *
 * ONE-WAY and semi-destructive for the CALLER: by the time this resolves the backend has revoked
 * every refresh token of the acting admin AND blacklisted their still-valid access token (§8), so
 * their own session no longer exists anywhere. The response is an ordinary `LoginResultModel` for
 * the TARGET — hand it to `adoptSession` immediately; there is nothing to fall back to.
 *
 * `credentials: 'include'` is not optional here even though the request itself is bearer-authorised:
 * the response SETS the target's refresh cookie, and a cross-origin response's `Set-Cookie` is
 * dropped by the browser unless the request was made in credentials mode.
 *
 * Gated by the `can_impersonate` claim (403 without it), plus: 400 `CannotImpersonateSelf` (2217),
 * 403 `ImpersonationTargetNotAllowed` (2218) for an elevated target when the actor is not
 * SuperAdmin, 404 `RelationalEntityNotFound` (2003) for a missing/deleted account.
 */
export function impersonateUser(id: number): Promise<LoginResultModel> {
  return authFetch<LoginResultModel>(`api/Users/${id}/Impersonate`, {
    method: 'POST',
    credentials: 'include',
  })
}

/* -------------------------------------------------------------------------- */
/*  Personal permission overrides                                              */
/* -------------------------------------------------------------------------- */

/**
 * GET the account's personal overrides on top of its role.
 *
 * Gated by `users.View` server-side — but the UI shows the editor only to a system Admin
 * (`UserDetailPage`), because editing overrides is administering the permission system and the
 * screen registry the grid is built from (`api/Screens`) is Admin-only.
 *
 * Returns ONLY the screens that actually have an override row; everything else inherits the role.
 */
export function getUserPermissionOverrides(id: number): Promise<ScreenOverrideModel[]> {
  return authFetch<ScreenOverrideModel[]>(`api/Users/${id}/PermissionOverrides`)
}

/**
 * PUT the whole override set (`users.Update`). A REPLACE, not a patch: a screen absent from
 * `overrides` — or present with all four flags `null` — loses its override and inherits the role
 * again. The target account comes from the route, never from the body (the backend ignores
 * `model.userId` for that reason).
 */
export function putUserPermissionOverrides(
  model: UserPermissionOverrideSaveModel,
): Promise<ScreenOverrideModel[]> {
  return authFetch<ScreenOverrideModel[]>(`api/Users/${model.userId}/PermissionOverrides`, {
    method: 'PUT',
    body: JSON.stringify(model),
  })
}
