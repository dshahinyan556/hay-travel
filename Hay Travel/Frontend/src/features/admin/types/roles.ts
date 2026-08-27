/**
 * Wire DTOs of the roles / screens / permission-override endpoints.
 *
 * Mirror of `ATTours.Common/DTO/Authorization/*` (§3.2 of the backend architecture). camelCase,
 * because the API serialises with the default camelCase policy — same convention as every other
 * DTO in this feature.
 */

import type { AccessLevel, PermissionAction, RoleType } from '@/shared/auth'

/**
 * One row of a ROLE's matrix: one granted level, no inheritance involved.
 *
 * Replaced the four `canView/canCreate/canUpdate/canDelete` booleans (spec 014 §1.6): the levels
 * are a ladder, each including everything below it, so four independent flags could express states
 * the backend does not consider possible ("create but not view").
 */
export interface ScreenPermissionModel {
  screenKey: string
  level: AccessLevel
}

export interface RoleInfoModel {
  id: number
  name: string
  /** `null` for a custom role; one of the four built-in tiers for a seeded one — display only,
   * does not affect what the role may do (see `canManageAdmins`). */
  type: RoleType | null
  /** May this role touch (assign/unassign/delete) other accounts that also carry this flag.
   * Settable only by SuperAdmin (`RoleForm` disables the control for anyone else). */
  canManageAdmins: boolean
  /** May this role sign in as another account («Войти как пользователь», spec 014 §2.2). Not part
   * of the matrix — a cross-cutting privilege, settable only by SuperAdmin, exactly like
   * `canManageAdmins`. */
  canImpersonate: boolean
  /** How many accounts are on this role — drives the "cannot delete, N users" rule. */
  userCount: number
  /** Filled for EVERY key of the registry: the backend pads missing rows with `level: None`. */
  permissions: ScreenPermissionModel[]
}

/**
 * POST/PUT body. `id` is `null`/absent when creating.
 *
 * `canManageAdmins`/`canImpersonate` must always carry the role's CURRENT value when the actor is
 * not changing them: the backend compares the submitted value against what is stored and answers
 * 403 on a change it does not allow — it does not read an omitted field as "leave as is".
 */
export interface RoleSaveModel {
  id?: number | null
  name: string
  canManageAdmins: boolean
  canImpersonate: boolean
  permissions: ScreenPermissionModel[]
}

/** One entry of `GET api/Screens` — the registry the matrix editor is built from. */
export interface ScreenDefinitionModel {
  key: string
  /** Russian caption from the backend. Used only as a FALLBACK: the UI prefers its own localized
   * label, so an unknown key still renders with a readable name instead of a raw key. */
  displayName: string
  /** Which of the four actions apply to this screen (e.g. regions have View + Update only). */
  actions: PermissionAction[]
}

/**
 * One row of a USER's personal override. `level: null` means "inherit whatever the role says" —
 * that is the whole point of a separate DTO from `ScreenPermissionModel`.
 *
 * An explicit `None` is NOT the same as `null`: it takes the screen away from an account whose role
 * grants it, while `null` simply defers to the role.
 */
export interface ScreenOverrideModel {
  screenKey: string
  level: AccessLevel | null
}

/** PUT body of `api/Users/{id}/PermissionOverrides`. A key absent from `overrides` is removed. */
export interface UserPermissionOverrideSaveModel {
  userId: number
  overrides: ScreenOverrideModel[]
}
