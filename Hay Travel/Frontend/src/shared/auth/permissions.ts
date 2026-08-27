/**
 * The ONLY place in the frontend that answers "may I?".
 *
 * Since roles became user-creatable there is no fixed matrix to compare against, so the named
 * per-feature predicates that used to live here (`canManageTours`, `canManageCatalog`, …) are gone
 * and were NOT replaced by thin wrappers. They could not be translated one-to-one — `canManageCalendar`
 * gated both `/admin/calendar` and `/admin/orders`, which are now two independent keys, and
 * `canManageCatalog` gated five — so a wrapper keeping the old name would glue back together exactly
 * what this migration separates. What remains is one universal question asked by
 * (`screenKey`, `action`), which is also what makes adding a screen a mechanical change here: nothing.
 *
 * Every matrix predicate is a PURE READ of `permissionStore`'s snapshot and takes no state argument:
 * the resolved set belongs to the signed-in session, and "what may some other user do?" is not a
 * question this app asks (the role editor works with role DTOs, not with these predicates).
 *
 * WHERE TO CALL WHAT:
 *  - route loaders → these functions, after `await ensurePermissionsReady()`;
 *  - components → `usePermissions()` / `useScreenPermission()` from `./usePermissions`, which
 *    subscribe. A bare predicate inside a component reads the store once and would keep rendering a
 *    stale answer after a background refresh.
 *
 * Before the set is `ready` every matrix predicate answers `false` (deny by default). No user ever
 * sees that state: the loaders await the set first.
 *
 * IMPORTANT: this is UX only. The backend enforces the same matrix on every endpoint
 * (`[RequiresPermission]`); hiding a control here just avoids offering an action that would 403.
 */

import { getPermissions, type PermissionSnapshot, type ScreenPermission } from './permissionStore'
import { PermissionAction, type KnownScreenKey } from './screens'
import type { AuthUser } from './types'

const NO_ACCESS: ScreenPermission = Object.freeze({
  canView: false,
  canCreate: false,
  canUpdate: false,
  canDelete: false,
})

const FULL_ACCESS: ScreenPermission = Object.freeze({
  canView: true,
  canCreate: true,
  canUpdate: true,
  canDelete: true,
})

/**
 * The gate rule, byte-for-byte the backend's own: `allowed = isAdmin || level >= action`
 * (`PermissionClaims.Allowed`). The comparison itself happens in `permissionStore`, which turns the
 * screen's single `AccessLevel` into the four flags read below — so the `!row.canView` test here is
 * no longer a separate gate but simply "level is `None`", which is the same answer.
 *
 * Exported for `usePermissions`, which needs to apply the same rule to a snapshot it already holds
 * (so the result can be memoised and stay referentially stable). Not part of the public barrel.
 */
export function resolveScreenPermissionIn(
  snapshot: PermissionSnapshot,
  screen: string,
): ScreenPermission {
  if (snapshot.status !== 'ready') return NO_ACCESS
  if (snapshot.isAdmin) return FULL_ACCESS

  const row = snapshot.screens[screen]
  if (row === undefined || !row.canView) return NO_ACCESS
  return row
}

/* ── Matrix predicates ──────────────────────────────────────────────────────────────────── */

/** May the signed-in user perform `action` on `screen`? */
export function can(screen: KnownScreenKey, action: PermissionAction): boolean {
  const resolved = resolveScreenPermissionIn(getPermissions(), screen)
  switch (action) {
    case PermissionAction.View:
      return resolved.canView
    case PermissionAction.Create:
      return resolved.canCreate
    case PermissionAction.Update:
      return resolved.canUpdate
    case PermissionAction.Delete:
      return resolved.canDelete
  }
}

/** May they open the screen at all? The predicate every route guard uses. */
export function canView(screen: KnownScreenKey): boolean {
  return can(screen, PermissionAction.View)
}

export function canCreate(screen: KnownScreenKey): boolean {
  return can(screen, PermissionAction.Create)
}

export function canUpdate(screen: KnownScreenKey): boolean {
  return can(screen, PermissionAction.Update)
}

export function canDelete(screen: KnownScreenKey): boolean {
  return can(screen, PermissionAction.Delete)
}

/**
 * Is AT LEAST ONE of these screens viewable?
 *
 * `/admin/catalog` is one route over five independent keys: it opens when any single tab is
 * readable, and the loader then fetches only the lists whose own key passes.
 */
export function canViewAny(screens: readonly KnownScreenKey[]): boolean {
  return screens.some((screen) => canView(screen))
}

/**
 * Can this session see ANY part of the panel? The gate of `/admin` itself (`adminRootLoader`).
 *
 * Note it asks the RESOLVED set, not the token bit: by the time the panel root is reached the matrix
 * has been fetched, and it is the more current of the two.
 */
export function hasAnyScreenAccess(): boolean {
  const snapshot = getPermissions()
  if (snapshot.status !== 'ready') return false
  if (snapshot.isAdmin) return true
  return Object.values(snapshot.screens).some((screen) => screen.canView)
}

/* ── Predicates that are NOT part of the matrix ─────────────────────────────────────────── */

/**
 * Show the «Админ-панель» link on the PUBLIC site?
 *
 * Reads `AuthUser.hasPanelAccess` — a bit taken from the access token — instead of the store, and
 * that asymmetry is the point: the public site never loads the matrix, and downloading eleven rows
 * of permissions to decide whether to render one link would be a poor trade. Inside `/admin` this
 * function is not used; `hasAnyScreenAccess()` is.
 */
export function canOpenAdminPanel(user: AuthUser | null | undefined): boolean {
  return user?.hasPanelAccess === true
}

/**
 * Touch a `CanManageAdmins` role at all: grant/revoke that flag on a role, assign a user to (or
 * off) such a role, or delete such a user's account. Everyone else — including a role with every
 * matrix box checked — sees those controls locked.
 *
 * Simplified 2026-08-22: no role (not even the seeded "Администратор") carries elevated power by
 * being who it nominally is — `CanManageAdmins` is one editable flag on the role, settable only by
 * SuperAdmin, and this predicate is now purely "is the signed-in account SuperAdmin?". The old
 * extra check (`user.role === RoleType.Admin`) stopped meaning anything once a role literally
 * named "Admin" could be stripped down to nothing, or a role named anything else could hold full
 * rights — see `docs/checklists/checklist-flexible-roles.txt` (part 2).
 *
 * Same UX-only caveat as everything above — the backend re-reads the flag from the database and
 * answers 403 `SuperAdminPrivilegeRequired` regardless of what the client decided to render.
 */
export function canManageAdmins(user: AuthUser | null | undefined): boolean {
  return user?.isSuperAdmin === true
}

/**
 * Sign in as somebody else — «Войти как пользователь» (spec 014 §3).
 *
 * NOT part of the matrix: impersonation is a cross-cutting privilege of the ROLE
 * (`UserRole.CanImpersonate`, settable only by SuperAdmin), not an action on a screen, so it is
 * asked here next to `canManageAdmins` rather than through `can(screen, action)`. Read from the
 * access token's `can_impersonate` claim, which the backend emits only when the role carries the
 * flag or the account is SuperAdmin.
 *
 * Same UX-only caveat as everything above: `[RequiresImpersonate]` re-checks the claim server-side
 * and answers 403, and the endpoint additionally refuses elevated targets (2218).
 */
export function canImpersonate(user: AuthUser | null | undefined): boolean {
  return user?.canImpersonate === true
}
