/**
 * The ONLY place in the frontend that compares roles.
 *
 * Every guard, every hidden button and every nav item asks a named question here instead of
 * writing `role === RoleType.Admin` inline — so when the backend's role matrix changes, exactly
 * one file changes with it. These are pure predicates over a possibly-absent role (`null` while
 * the store is still bootstrapping, or for an anonymous visitor), so call sites never need a
 * null-check of their own.
 *
 * IMPORTANT: this is UX only. The backend enforces the same matrix on every endpoint
 * (`ApiRoles.cs`); hiding a control here just avoids showing an action that would 403.
 */

import { RoleType, type AuthUser } from './types'

type MaybeRole = RoleType | null | undefined

const isAdmin = (role: MaybeRole): boolean => role === RoleType.Admin
const isStaff = (role: MaybeRole): boolean => role === RoleType.Admin || role === RoleType.TourManager

/** Can see `/admin` at all. Anyone else gets the "недостаточно прав" screen. */
export const canOpenAdminPanel = isStaff

/* ── Tours ──────────────────────────────────────────────────────────────────────────────── */

/** Create / edit tours (`InitTour`, `CreateTour`, `UpdateTour`, `InitUpdate`). */
export const canManageTours = isStaff
/** Toggle the published flag (`SetActive`). */
export const canPublishTours = isStaff
/** Archive / restore (`SetArchived`) — reversible, so not admin-only. */
export const canArchiveTours = isStaff
/** Permanent delete (`DeleteTour`) — admin only. */
export const canDeleteTours = isAdmin
/** Feature on the home page (`SetFeatured`, `ReorderFeatured`) — admin only. */
export const canFeatureTours = isAdmin

/* ── Reference catalogs ─────────────────────────────────────────────────────────────────── */

/**
 * READ the reference catalogs (`Place/GetAll`, `ExpenseTemplate/GetAll`,
 * `TourNoteTemplate/GetAll`, `Region/GetAll`). Deliberately wider than `canManageCatalog`: the
 * tour form's loaders fetch all four to populate its pickers, so a TourManager who could not read
 * them could not create a tour at all.
 */
export const canViewCatalog = isStaff
/** CREATE/UPDATE/DELETE catalog entries — i.e. open the «Справочники» screen. Admin only. */
export const canManageCatalog = isAdmin

/* ── Everything else ────────────────────────────────────────────────────────────────────── */

/** «Настройки» (`SiteSettings/GetAll`, `SiteSettings/Update`). */
export const canManageSettings = isAdmin
/** «Пользователи» (`api/Users`, `api/Users/ChangeRole`). */
export const canManageUsers = isAdmin
/** «Календарь» (`api/Availability/*`, `Order/GetAll`) — the whole availability controller and the
 * admin order list are Admin-only server-side, exactly like «Пользователи». */
export const canManageCalendar = isAdmin

/**
 * Touch the Admin tier at all (D3/ADR 011): grant or revoke the Admin role, and delete somebody
 * else's Admin account. Everyone else — including ordinary Admins — sees those controls locked.
 *
 * Takes the whole user, not a role, because SuperAdmin is a flag rather than a tier. The role check
 * is NOT redundant: a SuperAdmin who was demoted in the database must not keep seeing admin-only
 * management just because their token still carries the flag.
 *
 * Same UX-only caveat as everything above — the backend re-reads the flag from the database and
 * answers 403 `SuperAdminPrivilegeRequired` regardless of what the client decided to render.
 */
export const canManageAdmins = (user: AuthUser | null | undefined): boolean =>
  user?.isSuperAdmin === true && user.role === RoleType.Admin
