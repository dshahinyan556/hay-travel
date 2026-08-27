/**
 * Mirror of `ATTours.Common/Authorization/AdminScreens.cs` and
 * `ATTours.Common/Enums/PermissionAction.cs`.
 *
 * A zero-import leaf (like `shared/types/employeeRole.ts`): `types.ts`, the permission store and
 * any feature may import it without risking a cycle.
 *
 * This list exists ONLY for type-safety at the call sites of the predicates (`canView(
 * AdminScreen.Orders)` instead of `canView('orders')`). It is deliberately NOT the source of truth
 * for the permission MATRIX EDITOR — that one iterates `GET api/Screens`, so a screen the backend
 * knows about but this bundle does not is still manageable (it just shows up with the backend's
 * Russian caption). See `docs/architecture-flexible-roles-frontend.md` §0.6.
 */

export const AdminScreen = {
  Dashboard: 'dashboard',
  Products: 'products',
  Calendar: 'calendar',
  Orders: 'orders',
  CatalogPlaces: 'catalog.places',
  CatalogExpenseTemplates: 'catalog.expense-templates',
  CatalogNoteTemplates: 'catalog.note-templates',
  CatalogRegions: 'catalog.regions',
  CatalogTags: 'catalog.tags',
  Users: 'users',
  Roles: 'roles',
  Notifications: 'notifications',
  Settings: 'settings',
} as const

/** A key this build of the frontend knows about. Every predicate call is typed with it. */
export type KnownScreenKey = (typeof AdminScreen)[keyof typeof AdminScreen]

/**
 * A key "off the wire". The matrix editor works with whatever `GET api/Screens` returned, which
 * may include keys added on the backend after this bundle was built.
 */
export type ScreenKey = string

/** All known keys, in the backend registry's order (= row order in the matrix). */
export const ALL_SCREEN_KEYS: readonly KnownScreenKey[] = [
  AdminScreen.Dashboard,
  AdminScreen.Products,
  AdminScreen.Calendar,
  AdminScreen.Orders,
  AdminScreen.CatalogPlaces,
  AdminScreen.CatalogExpenseTemplates,
  AdminScreen.CatalogNoteTemplates,
  AdminScreen.CatalogRegions,
  AdminScreen.CatalogTags,
  AdminScreen.Users,
  AdminScreen.Roles,
  AdminScreen.Notifications,
  AdminScreen.Settings,
]

/**
 * Mirror of the backend `PermissionAction` enum. A frozen const object rather than a TS `enum`
 * because the project's tsconfig sets `erasableSyntaxOnly` — same convention as `RoleType`.
 */
export const PermissionAction = { View: 1, Create: 2, Update: 3, Delete: 4 } as const

export type PermissionAction = (typeof PermissionAction)[keyof typeof PermissionAction]

/** Column order in the matrix. */
export const ALL_PERMISSION_ACTIONS: readonly PermissionAction[] = [
  PermissionAction.View,
  PermissionAction.Create,
  PermissionAction.Update,
  PermissionAction.Delete,
]

/**
 * Mirror of the backend `AccessLevel` enum (spec 014 §1.1) — the GRANT side of the permission
 * model, where `PermissionAction` above is the DEMAND side.
 *
 * ONE level per screen, and the numbers are deliberately identical to `PermissionAction`'s, so
 * "does the granted level cover the required action" is a plain `level >= action` comparison —
 * exactly what `PermissionClaims.Allowed` does server-side. `None = 0` has no `PermissionAction`
 * counterpart: an endpoint never demands "nothing".
 *
 * Numeric, not a string union: the API serialises enums as numbers (Newtonsoft, camelCase
 * resolver, no `StringEnumConverter`), same as `PermissionAction` and `TourInfoModel.type`. The
 * `AccessLevel` in `shared/ui/AccessLevelSelect` is a different thing — the dropdown's own string
 * union — and `features/admin/roles/lib/roleModel.ts` is the one place that maps between them.
 */
export const AccessLevel = { None: 0, View: 1, Create: 2, Update: 3, Delete: 4 } as const

export type AccessLevel = (typeof AccessLevel)[keyof typeof AccessLevel]

/** Ascending, `None` first — the order the matrix dropdown lists levels in. */
export const ALL_ACCESS_LEVELS: readonly AccessLevel[] = [
  AccessLevel.None,
  AccessLevel.View,
  AccessLevel.Create,
  AccessLevel.Update,
  AccessLevel.Delete,
]

/**
 * Does a granted level cover an action? The whole hierarchy rule, in one place: each level implies
 * every action below it (`Delete` grants View + Create + Update as well).
 */
export function levelAllows(level: AccessLevel, action: PermissionAction): boolean {
  return level >= action
}

/**
 * The five catalog keys. `/admin/catalog` is ONE route with five independent permission keys, so
 * both its guard (`canViewAny`) and its nav entry need the group as a unit (§0.8).
 */
export const CATALOG_SCREEN_KEYS: readonly KnownScreenKey[] = [
  AdminScreen.CatalogPlaces,
  AdminScreen.CatalogExpenseTemplates,
  AdminScreen.CatalogNoteTemplates,
  AdminScreen.CatalogRegions,
  AdminScreen.CatalogTags,
]
