/**
 * Pure functions over the permission matrix — no React, no I/O, so the rules that must match the
 * backend exactly live somewhere they can be read and tested on their own.
 *
 * Since spec 014 §1 a screen carries ONE `AccessLevel`, not four independent flags, and each level
 * implies everything below it. That made the old "clearing Просмотр clears the rest" side-effect
 * obsolete — the hierarchy is now structural (you cannot pick `Create` and separately un-pick
 * `View`), so there is no cascade to apply and no invalid combination to repair. What remains is
 * the OTHER rule the backend enforces: a level must be one the screen actually supports
 * (`AdminScreens.IsAssignableLevel`, rejected with 400 `InvalidPermissionLevel`), which is why the
 * editor asks `assignableLevels` instead of offering all five everywhere.
 */

import {
  AccessLevel,
  AdminScreen,
  CATALOG_SCREEN_KEYS,
  levelAllows,
  PermissionAction,
  type ScreenKey,
} from '@/shared/auth'
// The dropdown speaks a string union of its own (`'None' | 'View' | …`) while the wire speaks the
// backend enum's numbers. This module is the ONE place that maps between the two.
import type { AccessLevel as AccessLevelName } from '@/shared/ui'
import { screenLabel, type AdminScreensCopy } from '@/features/admin/lib/adminScreensCopy'
import type {
  RoleInfoModel,
  ScreenDefinitionModel,
  ScreenOverrideModel,
  ScreenPermissionModel,
} from '@/features/admin/types/roles'
import type { PermissionMatrixRow } from '@/features/admin/ui/PermissionMatrix'
import type { RolesCopy } from './rolesCopy'

/* -------------------------------------------------------------------------- */
/*  Wire enum ↔ dropdown union                                                 */
/* -------------------------------------------------------------------------- */

const NAME_OF_LEVEL: Record<AccessLevel, AccessLevelName> = {
  [AccessLevel.None]: 'None',
  [AccessLevel.View]: 'View',
  [AccessLevel.Create]: 'Create',
  [AccessLevel.Update]: 'Update',
  [AccessLevel.Delete]: 'Delete',
}

const LEVEL_OF_NAME: Record<AccessLevelName, AccessLevel> = {
  None: AccessLevel.None,
  View: AccessLevel.View,
  Create: AccessLevel.Create,
  Update: AccessLevel.Update,
  Delete: AccessLevel.Delete,
}

export function levelName(level: AccessLevel): AccessLevelName {
  return NAME_OF_LEVEL[level]
}

export function levelOfName(name: AccessLevelName): AccessLevel {
  return LEVEL_OF_NAME[name]
}

/* -------------------------------------------------------------------------- */
/*  Screen registry                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Which levels this screen may be SET to — `None` plus its applicable actions, ascending.
 *
 * Mirrors `AdminScreens.IsAssignableLevel`: the applicable actions are exactly the assignable
 * levels above `None`, so `catalog.regions` (View + Update) offers None/View/Update and never
 * Create or Delete. `PermissionAction`'s numbers ARE `AccessLevel`'s numbers by design (spec 014
 * §1.1), which is why the actions can be used as levels without a conversion table.
 */
export function assignableLevels(actions: readonly PermissionAction[]): readonly AccessLevel[] {
  return [AccessLevel.None, ...[...actions].sort((a, b) => a - b)]
}

/**
 * Mirror of `AdminScreens.CapLevel`: the highest assignable level not exceeding `level`.
 *
 * Defensive, for data this editor did not produce — a row stored before a screen lost one of its
 * actions would otherwise select nothing in the dropdown and read as "no value at all".
 */
export function capLevel(levels: readonly AccessLevel[], level: AccessLevel): AccessLevel {
  let capped: AccessLevel = AccessLevel.None
  for (const candidate of levels) if (candidate <= level && candidate > capped) capped = candidate
  return capped
}

function emptyPermission(screenKey: ScreenKey): ScreenPermissionModel {
  return { screenKey, level: AccessLevel.None }
}

/* -------------------------------------------------------------------------- */
/*  Role matrix                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Registry + role → editor rows.
 *
 * The REGISTRY drives the rows, not the role's own `permissions`: a key the role has no row for is
 * still editable (level `None`), and a stale key the role still carries but the registry dropped is
 * ignored — the same precedence the backend applies.
 */
export function buildRoleMatrixRows(
  role: RoleInfoModel | null,
  screens: ScreenDefinitionModel[],
  labels: AdminScreensCopy,
): PermissionMatrixRow[] {
  const byKey = new Map((role?.permissions ?? []).map((row) => [row.screenKey, row]))

  return screens.map((screen) => {
    const levels = assignableLevels(screen.actions)
    const source = byKey.get(screen.key) ?? emptyPermission(screen.key)
    return {
      screenKey: screen.key,
      label: screenLabel(labels, screen.key, screen.displayName),
      levels,
      value: capLevel(levels, source.level ?? AccessLevel.None),
    }
  })
}

/**
 * Apply one row's edit. Trivial now that a row holds a single value — kept as a named function
 * anyway so the state update stays immutable in one place instead of being spelled out at both
 * call sites (`useRoleForm`, `UserPermissionsCard`).
 */
export function applyLevelChange(
  rows: PermissionMatrixRow[],
  screenKey: string,
  value: AccessLevel | null,
): PermissionMatrixRow[] {
  return rows.map((row) => (row.screenKey === screenKey ? { ...row, value } : row))
}

/**
 * Rows → save payload.
 *
 * Every registry key is emitted, including the `None` ones: `RoleSaveModel.permissions` is the
 * complete new matrix, not a patch. `capLevel` is applied once more on the way out — the dropdown
 * cannot produce an inapplicable level, but sending one would be a 400, and the guarantee is worth
 * more here than the one line it costs.
 */
export function rowsToPermissions(rows: PermissionMatrixRow[]): ScreenPermissionModel[] {
  return rows.map((row) => ({
    screenKey: row.screenKey,
    level: capLevel(row.levels, row.value ?? AccessLevel.None),
  }))
}

/** True when the two matrices differ. Order-insensitive: compared key by key. */
export function isMatrixDirty(a: ScreenPermissionModel[], b: ScreenPermissionModel[]): boolean {
  if (a.length !== b.length) return true
  const byKey = new Map(b.map((row) => [row.screenKey, row]))
  return a.some((row) => {
    const other = byKey.get(row.screenKey)
    return other === undefined || other.level !== row.level
  })
}

/**
 * §0.8's warning: the tour form loads all five catalogs, so `products` at `Create` or above without
 * `catalog.*` at `View` or above produces a role that can reach the form and then gets a 403 from it.
 *
 * Deliberately a WARNING and not an auto-correction: silently raising five other rows the admin did
 * not touch is worse than telling them what is missing.
 */
export function catalogDependencyHint(
  rows: PermissionMatrixRow[],
  copy: RolesCopy,
): string | undefined {
  const products = rows.find((row) => row.screenKey === AdminScreen.Products)
  if (products === undefined) return undefined

  const writesProducts = levelAllows(products.value ?? AccessLevel.None, PermissionAction.Create)
  if (!writesProducts) return undefined

  const allCatalogsVisible = CATALOG_SCREEN_KEYS.every((key: string) => {
    const row = rows.find((candidate) => candidate.screenKey === key)
    // A catalog this build does not know about cannot be judged — treat it as satisfied.
    return row === undefined || levelAllows(row.value ?? AccessLevel.None, PermissionAction.View)
  })

  return allCatalogsVisible ? undefined : copy.catalogDependencyHint
}

/* -------------------------------------------------------------------------- */
/*  Personal overrides                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Registry + the user's role matrix + their overrides → editor rows in `override` mode.
 *
 * `inherited` carries the level the ROLE grants, so a row left on "наследовать" can still show the
 * outcome — without it an empty control would be unreadable.
 */
export function buildOverrideMatrixRows(
  screens: ScreenDefinitionModel[],
  rolePermissions: ScreenPermissionModel[],
  overrides: ScreenOverrideModel[],
  labels: AdminScreensCopy,
): PermissionMatrixRow[] {
  const roleByKey = new Map(rolePermissions.map((row) => [row.screenKey, row]))
  const overrideByKey = new Map(overrides.map((row) => [row.screenKey, row]))

  return screens.map((screen) => {
    const levels = assignableLevels(screen.actions)
    const roleLevel = roleByKey.get(screen.key)?.level ?? AccessLevel.None
    const overrideLevel = overrideByKey.get(screen.key)?.level ?? null

    return {
      screenKey: screen.key,
      label: screenLabel(labels, screen.key, screen.displayName),
      levels,
      value: overrideLevel === null ? null : capLevel(levels, overrideLevel),
      inherited: capLevel(levels, roleLevel),
    }
  })
}

/**
 * Rows → override payload.
 *
 * Only rows with an explicit level are sent: the endpoint treats "absent" as "drop the override",
 * so an inherited row must NOT be transmitted (sending it with `level: null` would ask the server
 * to store an override that says nothing). An explicit `None` IS sent — it is a real override
 * meaning "take this screen away despite the role".
 */
export function rowsToOverrides(rows: PermissionMatrixRow[]): ScreenOverrideModel[] {
  const result: ScreenOverrideModel[] = []
  for (const row of rows) {
    if (row.value === null) continue
    result.push({ screenKey: row.screenKey, level: capLevel(row.levels, row.value) })
  }
  return result
}

/** How many screens deviate from the role — the collapsed card's summary. */
export function countOverrides(overrides: ScreenOverrideModel[]): number {
  return overrides.filter((row) => row.level !== null).length
}

/** Set every row back to "inherit". The reset button stages this; saving is what applies it. */
export function clearAllOverrides(rows: PermissionMatrixRow[]): PermissionMatrixRow[] {
  return rows.map((row) => ({ ...row, value: null }))
}

/** True when the two override sets differ. */
export function areOverridesDirty(a: ScreenOverrideModel[], b: ScreenOverrideModel[]): boolean {
  if (a.length !== b.length) return true
  const byKey = new Map(b.map((row) => [row.screenKey, row]))
  return a.some((row) => {
    const other = byKey.get(row.screenKey)
    return other === undefined || other.level !== row.level
  })
}

/* -------------------------------------------------------------------------- */
/*  Role privileges outside the matrix                                         */
/* -------------------------------------------------------------------------- */

/**
 * Does the role at `roleId` carry `CanManageAdmins`? `roles` is `null` when the caller could not
 * read `GET api/Roles` (lacks `roles.View`), in which case this answers `false` — a UI-only
 * under-lock (the backend re-checks and answers 403 regardless of what this rendered).
 * `UserInfoModel`/`UserDetailInfoModel` carry only `roleId`/`roleName`, never the role's own
 * flags, so every call site that used to compare `user.role === RoleType.Admin` needs this lookup
 * instead (решение Давида 2026-08-22 — no fixed `RoleType` means anything about privilege any more).
 */
export function roleHoldsCanManageAdmins(roleId: number, roles: RoleInfoModel[] | null): boolean {
  return roles?.find((role) => role.id === roleId)?.canManageAdmins === true
}

/**
 * Does the role at `roleId` carry `CanImpersonate`? Same lookup-by-id shape and the same UI-only
 * caveat as `roleHoldsCanManageAdmins` above.
 *
 * Used to predict the backend's privilege-escalation guard (spec 014 §3.3): a non-SuperAdmin may
 * not impersonate a target whose role manages admins or can itself impersonate.
 */
export function roleHoldsCanImpersonate(roleId: number, roles: RoleInfoModel[] | null): boolean {
  return roles?.find((role) => role.id === roleId)?.canImpersonate === true
}
