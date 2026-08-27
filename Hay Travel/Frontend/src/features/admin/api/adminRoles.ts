/**
 * Roles & screens API — `api/Roles` and `api/Screens`.
 *
 * Both controllers are gated by the `roles` matrix key like any other screen (решение Давида
 * 2026-08-22) — the frontend checks `canView`/`canCreate`/`canUpdate`/`canDelete(AdminScreen.Roles)`
 * exactly as it does everywhere else. `RoleSaveModel.canManageAdmins` is the one field that stays
 * SuperAdmin-exclusive regardless of `roles.Update` — enforced server-side, not here.
 */

import { authFetch } from '@/shared/auth'
import type {
  RoleInfoModel,
  RoleSaveModel,
  ScreenDefinitionModel,
} from '@/features/admin/types/roles'

/**
 * Every role with its full matrix (padded to all registry keys server-side).
 *
 * There is no `GET api/Roles/{id}`: roles number in the single digits, so the detail screen filters
 * this list rather than adding an endpoint that would return the same rows one at a time.
 */
export function getRoles(): Promise<RoleInfoModel[]> {
  return authFetch<RoleInfoModel[]>('api/Roles')
}

/** The screen registry: rows and applicable actions of the matrix editor. Computed, no database. */
export function getScreens(): Promise<ScreenDefinitionModel[]> {
  return authFetch<ScreenDefinitionModel[]>('api/Screens')
}

/** 400 `RoleNameInvalid` (2036) when the name is empty or taken; 403
 * `SuperAdminPrivilegeRequired` (2216) if `canManageAdmins: true` and the actor is not SuperAdmin. */
export function createRole(model: RoleSaveModel): Promise<RoleInfoModel> {
  return authFetch<RoleInfoModel>('api/Roles', { method: 'POST', body: JSON.stringify(model) })
}

/** 403 `SuperAdminPrivilegeRequired` (2216) if `canManageAdmins` changed and the actor is not
 * SuperAdmin; 404 `RoleNotFound` (2206) for an unknown id. */
export function updateRole(id: number, model: RoleSaveModel): Promise<RoleInfoModel> {
  return authFetch<RoleInfoModel>(`api/Roles/${id}`, { method: 'PUT', body: JSON.stringify(model) })
}

/** 409 `RoleInUse` (2034) while any account still holds the role — no role is otherwise exempt
 * from deletion any more (решение Давида 2026-08-22). */
export function deleteRole(id: number): Promise<void> {
  return authFetch<void>(`api/Roles/${id}`, { method: 'DELETE' })
}
