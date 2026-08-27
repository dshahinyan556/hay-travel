# ADR 027 — Access levels replace independent CRUD flags

Status: accepted (2026-08-22)
Context spec: [014](../specs/014-permission-levels-impersonation-sessions.md) §1

## Context
The flexible-roles system (uncommitted, undeployed) modelled per-(role, screen) and
per-(user, screen) rights as four independent booleans `CanView/CanCreate/CanUpdate/CanDelete`,
where `View` gates the others but Create/Update/Delete are mutually independent
(`PermissionClaims.Allowed`, comment lines 30-31). The business owner decided rights should
instead be a single **ordered level** `None < View < Create < Update < Delete`, each level
implying everything below it.

## Decision
- Introduce `AccessLevel { None=0, View=1, Create=2, Update=3, Delete=4 }` whose numeric values
  match the existing `PermissionAction` (View=1..Delete=4). Store one `Level` on `RolePermission`
  and one nullable `Level` on `UserPermissionOverride` (null = inherit).
- Keep `PermissionAction` unchanged as the **demand** side used by ~40 controller attributes;
  `AccessLevel` is the **grant** side. "Granted covers required" is `grantedLevel >= requiredAction`
  — a single integer comparison, so the controller attributes and `RequiresPermission` do not
  change.
- JWT encodes one letter per screen (`products:U`) instead of a subset string (`products:VCU`).
- Screens with non-contiguous applicable actions (e.g. `calendar` = View, Create, Delete, no
  Update) are handled by `AdminScreens.CapLevel`, which snaps any level down to the highest
  *applicable* action ≤ that level. This keeps a single global ladder correct without per-screen
  ladders.
- Migration: because the 4-bool columns live only in undeployed migrations, **edit the creating
  migration in place** to emit `Level` directly rather than authoring a production data-collapse
  migration. The collapse rule ("highest true flag", invalid combos widen upward) is kept only as
  a reference for local dev DBs.

## Alternatives rejected
- **Keep 4 independent bools.** Rejected: owner wants a single-axis level; independent bools let
  invalid business states (Update without Create) exist.
- **Per-screen level ladders (level value means different actions per screen).** Rejected: storage
  ambiguity and cross-screen comparison break; `CapLevel` on a global ladder solves the
  non-contiguous case without it.
- **Replace `PermissionAction` with `AccessLevel` everywhere.** Rejected: churns ~40 controller
  attributes for no gain; the demand side never needs `None`.

## Consequences
- Widening on collapse: an invalid legacy combo (`View+Update, no Create`) becomes `Update` and
  now also grants Create. Acceptable because the data is undeployed/seed-only (spec 014 §7.1).
- The admin Roles/Users matrix DTOs change from 4 bools to one level → breaking change for the
  matrix UI; frontend ships in lockstep.
- Smaller JWT (one letter per screen vs up to four).
