# ADR 030 — Instant access-token kill on impersonation via a scoped in-memory revocation registry

Status: accepted (2026-08-22)
Context spec: [014](../specs/014-permission-levels-impersonation-sessions.md) §8
Supersedes the "accept the ≤15 min window" tradeoff recorded in
[ADR 028](028-impersonation-via-authservice-kills-impersonator-session.md) (Alternatives
rejected / Consequences) and closes open risk 014 §7.2.

## Context
ADR 028 revokes **all** of an impersonator's refresh tokens on
`POST api/Users/{id}/Impersonate`, but access tokens are stateless 15-min JWTs. Nothing checks
an issued access token against a denylist per request, so the impersonator's already-issued
access token(s) stay valid for up to `AccessTokenMinutes` (15 min) after they impersonate —
including any token they stashed in another tab/device before impersonating. ADR 028 accepted
this residual window.

The business owner (David) has now rejected that tradeoff for impersonation specifically: he
wants an **instant kill** — the moment an admin impersonates, their own access token(s) must
stop working, with no ≤15-min residual. He frames it as a general principle ("no stale token
stays valid"), which is why the remember-me flush (014 §4.5) also exists. This ADR covers the
impersonation instant-kill only.

Hard constraint from the existing design (`ApiRoles.cs` / `JwtTokenService` comment "с
переходом на гибкие права… на каждый запрос БД не трогаем", ADR 011): authorization must **not**
regress into a per-request DB/cache round-trip for every endpoint. Baked-claim authorization
stays. Only impersonation needs the instant-kill guarantee.

## Decision
Add a **scoped, in-memory, per-user access-token revocation registry** consulted only inside the
permission-attribute pipeline.

- **What is stored:** a process-wide singleton
  `ConcurrentDictionary<int userId, RevocationEntry>` in `ATTours.Helper`, where
  `RevocationEntry` = `(DateTime CutoffUtc, DateTime EntryExpiresUtc)`. One entry per
  impersonation event. Meaning: "reject every access token whose `sub == userId` and whose `iat`
  (issued-at) is **before** `CutoffUtc`, until `EntryExpiresUtc`."
- **Who writes it, and when — the only trigger:** `AuthService.ImpersonateAsync`, in the same
  transaction where it already revokes the impersonator's refresh tokens, calls
  `registry.Revoke(actingUserId, cutoffUtc: now, entryExpiresUtc: now + AccessTokenMinutes)`.
  This is the single documented auth-state-change point (ADR 028); no other code path writes the
  registry. The registry is **not** touched on login/refresh/logout.
- **Who reads it, and when:** the three admin authorization filters —
  `RequiresPermissionAttribute`, `RequiresAnyPermissionAttribute`, `RequiresImpersonateAttribute`
  — consult it **first**, before the existing `HasPermission` / `IsSystemAdmin` checks (the
  SuperAdmin bypass must not skip the revocation check). They resolve the singleton from
  `HttpContext.RequestServices` (attributes can't take constructor DI) and call a shared
  `ClaimsPrincipal.IsAccessTokenRevoked(registry)` extension.
- **Fast path (no latency for the 99.9%):** `IsAccessTokenRevoked` returns `false` immediately
  when `registry.IsEmpty` — no claim parsing at all. The dictionary is empty except in the ≤15-min
  window after a (rare) impersonation event. Only inside that window does it read `sub` + `iat`
  and do an O(1) lookup. This is an in-memory dictionary probe, **not** a DB/cache round-trip, so
  it does not reverse the baked-claim decision.
- **Revoked result:** `401 Unauthorized` (not 403) — the impersonator must obtain a new token
  (log back in as themselves), consistent with the attributes' existing "unauthenticated → 401"
  reasoning.
- **TTL / cleanup:** `EntryExpiresUtc = CutoffUtc + AccessTokenMinutes`. After it, any token with
  `iat < CutoffUtc` is already naturally expired, so the entry is moot. Eviction is lazy (removed
  on read when `now >= EntryExpiresUtc`) plus an opportunistic sweep on each `Revoke` write. No
  background timer — write volume is tiny (only impersonation events).

## Why `iat`, not "reject all of the user's tokens"
After impersonating, the admin "must log in again as themselves" (ADR 028). A blanket "reject
every `sub == X` token for 15 min" would also reject the admin's **legitimate re-login** token
issued during that window. Comparing the token's `iat` against `CutoffUtc` distinguishes stale
pre-impersonation tokens (`iat < cutoff` → reject) from a fresh re-login token (`iat > cutoff` →
allow). Because all refresh tokens were revoked at `cutoff`, no new `sub == X` token can be minted
between `cutoff` and a real re-login, so no stale token can have `iat >= cutoff`.

`iat` readability is a prerequisite: `JwtTokenService` already emits a standard `iat` claim and
the default JwtBearer inbound map does not rename timestamp claims. If a token whose `sub` matches
a **live** revocation entry has an unreadable/absent `iat`, the check **fails closed** (treats it
as revoked → 401): our own tokens always carry `iat`, so an absent one on a penalty-box user is
anomalous, and David's instant-kill priority outranks the cost of one extra re-login in that
should-not-happen case. Backend-developer must confirm `iat` is present on issued tokens
(acceptance check in spec §8).

## Why in-memory (not distributed cache / DB flag)
Deployment is a **single backend container** on the netcup VPS (`docker-compose.yml` = one
`backend` + one `sqlserver`, no replicas/scale — see `docs/server-ops.md`). A process-local
`ConcurrentDictionary` is therefore correct, has zero external dependency, survives no restart
(acceptable — a restart also drops all in-flight access tokens' usefulness within their 15-min
TTL and forces refresh, which re-checks nothing stale), and costs nothing on the hot path.

**Multi-instance migration note (explicit):** if the backend is ever scaled to >1 replica behind
the load balancer, this in-memory registry becomes per-instance and no longer guarantees the kill
across instances. At that point the registry implementation must move behind the same
`IAccessTokenRevocationRegistry` interface to a shared store (Redis / `IDistributedCache`) with
the same key (`userId`) / value (`cutoff`) / TTL (`AccessTokenMinutes`) shape. The interface is
introduced now precisely so this is a one-class swap with no call-site changes.

## Scope boundary (what this deliberately does NOT do)
- It does **not** add a revocation check to every request/endpoint — only to the three admin
  permission filters. Endpoints gated solely by `[Authorize]` / `[Authorize(Roles=…)]` (meta
  screens, the Employee endpoint) are **not** covered. Justification: impersonation-capable admins
  operate on the permission-gated admin surface; the stale-token threat is "keep performing admin
  actions as myself after impersonating", and every such action is behind a permission filter.
  Covering the whole pipeline would mean a probe on truly every request (still cheap, but it
  reverses the explicit "scope it to impersonation" instruction) and is left out on purpose.
- It does **not** revoke the **target's** new session: the target token has `sub == targetUserId`
  (a different key) and `iat >= cutoff`, so it is untouched.
- It does **not** persist across process restart, and does not need to (see above).

## Alternatives rejected
- **Per-request DB/cache denylist for all endpoints.** Rejected — reverses ADR 011 / the
  baked-claim design and adds latency to every request for a rare event.
- **Denylist by the single `jti` of the token that called `Impersonate`.** Rejected — kills only
  the token used for the call, not a copy the admin stashed in another tab/device before
  impersonating, which is exactly the threat. Per-user `cutoff` catches all pre-event tokens in
  one entry.
- **Blanket per-user reject for 15 min (no `iat`).** Rejected — breaks the mandated
  "log in again as themselves" flow within the window.
- **Shorten `AccessTokenMinutes`.** Rejected — narrows but never closes the window, and shortens
  it for every user/flow to patch one path.

## Consequences
- The ≤15-min impersonator-token window from ADR 028 §Consequences is **closed**: a stale
  pre-impersonation access token bearing the impersonator's `sub` is rejected on its next
  permission-gated request, instantly.
- One new singleton (`IAccessTokenRevocationRegistry`) in `ATTours.Helper`, injected into
  `AuthService` and resolved from `RequestServices` in three attributes.
- `iat` presence on access tokens becomes a load-bearing invariant (acceptance-checked).
- A future multi-replica deployment requires swapping the registry implementation to a shared
  store (interface already in place).
