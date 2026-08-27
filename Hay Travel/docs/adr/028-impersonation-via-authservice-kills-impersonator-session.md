# ADR 028 — Impersonation lives in AuthService and destroys the impersonator's session

Status: accepted (2026-08-22)
Context spec: [014](../specs/014-permission-levels-impersonation-sessions.md) §2-3

## Context
The owner wants a "Sign in as user" feature, gated by a new `Users.Impersonate` privilege that
must be grantable to non-SuperAdmin roles. Hard requirement: after impersonating, the admin's
own session must stop existing — they cannot silently switch back and must log in again as
themselves. An audit trail of who impersonated whom is required.

## Decision
- **Privilege modelling:** `Users.Impersonate` is a cross-cutting privilege, not a screen CRUD
  action, so it does not fit the `AccessLevel` ladder (ADR 027). Model it as a boolean
  `UserRole.CanImpersonate`, mirroring the existing `UserRole.CanManageAdmins` precisely:
  per-role, toggled only by SuperAdmin, surfaced as a present-only-when-true JWT claim
  (`can_impersonate`), enforced by a dedicated `[RequiresImpersonate]` authorization filter.
- **Placement:** impersonation logic goes in `AuthService.ImpersonateAsync` — the documented
  single point where auth state (sessions/tokens) changes. The endpoint is
  `POST api/Users/{id}/Impersonate` (route belongs to the users vertical, target always from
  route → IDOR-safe); `UsersController` injects `IAuthService`.
- **Session destruction:** `ImpersonateAsync` revokes **all** the impersonator's refresh tokens
  and the response overwrites the shared refresh cookie with the target's, so the impersonator's
  session is gone. One-way by design: there is no un-impersonate endpoint; ending = logout.
- **Impersonation marker:** stored on the issued `RefreshToken` as `ImpersonatedByUserId` and
  copied on rotation, so the `imp_by` access-token claim (for the UI banner + attribution)
  survives token rotation for the life of the impersonated session.
- **Audit:** a dedicated `ImpersonationEvent` entity (impersonator, target, timestamp, IP, UA)
  written in the same transaction.
- **Privilege-escalation guard:** a non-SuperAdmin impersonator may not target a user who is
  SuperAdmin or whose role has `CanManageAdmins`/`CanImpersonate`; SuperAdmin may target anyone.

## Alternatives rejected
- **Dedicated privilege namespace/registry** for cross-cutting rights. Rejected as YAGNI: two
  boolean privileges (`CanManageAdmins`, `CanImpersonate`) don't justify it. Revisit if a third
  appears.
- **Impersonation service in the `new Service()` style** used by `UsersController`. Rejected:
  the operation issues tokens and manipulates refresh tokens — that is exactly AuthService's
  domain and reuses `RevokeAllRefreshTokensAsync` / `IJwtTokenService`.
- **Instantly killing the impersonator's access token.** Impossible with stateless JWTs without a
  per-request DB check that would defeat the baked-claim design. Accepted tradeoff: the
  impersonator's access token works ≤ `AccessTokenMinutes` (15 min) before refresh fails.

## Consequences
- ≤15 min window where the impersonator's old access token still works (spec 014 §7.2).
- `RefreshToken` gains a per-session audit pointer; rotation logic must copy it.
- A powerful privilege (`CanImpersonate`) is delegable to non-SuperAdmins — mitigated by the
  escalation guard and the SuperAdmin-only toggle.
