# Spec 017 — Session/device management + refresh rotation grace period

Status: Ready for implementation
Owner hand-off: backend-developer
Why (rationale): ADR [033](../adr/033-refresh-token-rotation-grace-period.md). Session lifecycle
context: spec [014](014-permission-levels-impersonation-sessions.md) §3–§4.

Two coupled deliverables against the existing auth vertical
(`AuthService` → `RefreshToken` → `AuthController` cookie handling):

- **A. Rotation grace period** — stop the reuse-detection branch from nuking all sessions on a
  legitimate cross-device refresh race.
- **B. Session/device management** — self-service and admin list + revoke.

Mirror the existing `LoginHistory` read vertical
(`LoginHistoryInfo` / `LoginHistoryModel` / `GET api/Users/{id}/LoginHistory`) for shape, and the
existing impersonation session mutations in `AuthService` for where session writes live.

---

## 1. Data model change (one column)

### `ATTours.Common/Entities/RefreshToken.cs` — EDIT
Add, alongside `CreatedByIp`:
```
public string CreatedByUserAgent { get; set; }   // nullable; audit-only device string
```
Russian comment: captured from `RequestContextModel.UserAgent`, already truncated to 512 by
`HttpContextExtensions.BuildRequestContext`. Nullable because pre-existing rows have none.

### `ATTours.Common/Infrastructure/EntityConfiguration/RefreshTokenConfiguration.cs` — EDIT
Add, next to the `CreatedByIp` mapping (same truncation convention):
```
builder.Property(x => x.CreatedByUserAgent).HasMaxLength(512);
```
Not required, no index.

### Migration — CREATE (`ATTours.DataLayer/Migrations`)
`dotnet ef migrations add AddRefreshTokenCreatedByUserAgent`.
Single `AddColumn<string>("CreatedByUserAgent", "RefreshToken", maxLength: 512, nullable: true)`.
No data backfill. Run `git status` before generating (EF shared-tree risk).

---

## 2. Persist UserAgent on every RefreshToken write (existing-pipe wire-up)
`RequestContextModel.UserAgent` is already captured; it just is not stored on `RefreshToken`.
In `AuthService.cs`, set `CreatedByUserAgent = requestContext.UserAgent` on every
`new RefreshToken { … }`:
- `LoginAsync` (~240)
- `DevLoginAsync` (~298)
- `RefreshAsync` rotation row (~375)
- `ImpersonateAsync` target-session row (spec 014 §3.2 site)
- the new catch-up mint in §3 below

---

## 3. A — Rotation grace period (`AuthService.RefreshAsync`, reuse branch ~339-344)

Add a private const near the other lifetimes:
```
private const int RefreshReuseGraceSeconds = 10;   // ADR 033
```

Replace the current unconditional nuke inside `if (storedToken.RevokedAtUtc.HasValue)` with the
ADR-033 ordered logic:

1. **Forgivable rotation race** — ALL of:
   - `storedToken.ReplacedByTokenHash != null`
   - `now - storedToken.RevokedAtUtc.Value <= TimeSpan.FromSeconds(RefreshReuseGraceSeconds)`
   - the single-hop replacement head is live: load
     `head = RefreshTokenRepository.AsQueryable().SingleOrDefaultAsync(x => x.TokenHash == storedToken.ReplacedByTokenHash)`;
     require `head != null && head.RevokedAtUtc == null && head.ExpiresAtUtc > now`.

   → **catch-up mint** (caller cannot receive the original successor plaintext — only its hash
   was ever stored — so advance the live head by one and give the caller that):
   0. Re-run the SAME three account-state checks as the normal rotation path
      (`IsDeleted` / `LockedUntil` / `IsEmailVerified`, on `storedToken.User`), in the same order,
      each rejecting via `RevokeAndRejectAsync(head, now, …)` (the LIVE head is the row to kill —
      `storedToken` is already revoked). **Decided 2026-08-29** (was open in the original spec):
      without this, an account locked/deleted/de-verified inside the 10s window could still catch
      up to one more ~15-minute access token via the forgiven path — no wider than the token that
      device already held, but a real gap. The three checks now run on BOTH paths.
   1. `var minted = jwtTokenService.CreateRefreshToken(head.RememberMe);`
   2. `head.RevokedAtUtc = now; head.ReplacedByTokenHash = minted.TokenHash;`
   3. add a new `RefreshToken` row: `UserId = head.UserId`, `TokenHash = minted.TokenHash`,
      `ExpiresAtUtc = minted.ExpiresAtUtc`, `CreatedAtUtc = now`,
      `CreatedByIp = requestContext.IpAddress`, `CreatedByUserAgent = requestContext.UserAgent`,
      `RememberMe = head.RememberMe`, `ImpersonatedByUserId = head.ImpersonatedByUserId`.
   4. `SaveChangesAsync`.
   5. issue access token off `storedToken.User` (already `Include`-loaded, same user as `head`):
      `CreateAccessToken(storedToken.User, await ResolvePermissionsAsync(storedToken.User, ct), head.ImpersonatedByUserId)`.
   6. `return new RefreshOutcome(accessToken, new IssuedRefreshToken(minted.Token, minted.ExpiresAtUtc, head.RememberMe));`

2. **Explicit-kill token** — `storedToken.ReplacedByTokenHash == null` → `throw RefreshTokenInvalid();`
   **No family nuke** (do not call `RevokeAllRefreshTokensAsync`).

3. **Genuine reuse (else)** — keep the current behavior verbatim:
   `RevokeAllRefreshTokensAsync(storedToken.UserId, now, null, ct)` + `SaveChanges` + `throw RefreshTokenInvalid();`

Update the `IAuthService.RefreshAsync` XML comment to reference ADR 033.

---

## 4. B — Session/device management

### 4.1 DTO — CREATE `ATTours.Common/DTO/Auth/SessionInfoModel.cs`
Mirror `LoginHistoryModel` + session-specific fields. `UserId` does NOT leave (list is always
by known user).
```
public class SessionInfoModel
{
    public int Id { get; set; }                 // RefreshToken.Id — the revoke handle
    public string CreatedByIp { get; set; }
    public string CountryCode { get; set; }
    public string CountryName { get; set; }
    public string City { get; set; }
    public string CreatedByUserAgent { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
    public bool IsCurrent { get; set; }         // self-service only; always false for admin view
}
```

### 4.2 AutoMapper — EDIT `ATTours.ClientAPI/Mapper/MappingProfile.cs`
`CreateMap<RefreshToken, SessionInfoModel>()` for scalar fields only. `IsCurrent`, `CountryCode`,
`CountryName`, `City` are set by the service after mapping (computed / geo-resolved), not mapped.

### 4.3 Service — all reads AND writes live in `AuthService` (NOT a new Info-service)
Rationale (decided, not open): every session write already belongs to `AuthService` per ADR
005/028, and it already holds `RefreshTokenRepository`, `jwtTokenService` (hashing), and
`geoIpLookup`. Splitting the paired reads into a separate `EntityInfoBase<RefreshToken>` would
fragment the `RefreshToken` domain. `LoginHistory` uses an Info-service only because it is a
read-only entity with no auth mutations — that does not apply here.

Add to `IAuthService.cs` / `AuthService.cs`:

Self-service:
```
Task<List<SessionInfoModel>> GetMySessionsAsync(int userId, string? currentRefreshToken, CancellationToken ct = default);
Task RevokeMySessionAsync(int userId, int sessionId, CancellationToken ct = default);
Task RevokeMyOtherSessionsAsync(int userId, string? currentRefreshToken, CancellationToken ct = default);
```
Admin:
```
Task<List<SessionInfoModel>> GetUserSessionsAsync(int targetUserId, CancellationToken ct = default);
Task RevokeUserSessionAsync(int targetUserId, int sessionId, CancellationToken ct = default);
Task RevokeAllUserSessionsAsync(int targetUserId, CancellationToken ct = default);
```

Behavior:
- **List** (both): query `RefreshTokenRepository` where `UserId == x && RevokedAtUtc == null &&
  ExpiresAtUtc > now`, order `CreatedAtUtc` desc, map to `SessionInfoModel`; resolve geo per row
  via `geoIpLookup.Lookup(CreatedByIp)` (local, cheap; null-safe like LoginAsync).
- **IsCurrent** (self-service list only): if `currentRefreshToken` is non-empty, compute
  `jwtTokenService.HashRefreshToken(currentRefreshToken)` and set `IsCurrent = true` on the row
  whose `TokenHash` matches. Admin list leaves `IsCurrent = false` (admin is not that user).
- **RevokeMySessionAsync / RevokeUserSessionAsync**: load the row by `sessionId`; **ownership
  guard** — if `row == null || row.UserId != (userId|targetUserId)` throw
  `ErrorModelException(RelationalEntityNotFound, NotFound)` (same 404 shape UsersController uses).
  This is what stops a normal user revoking a stranger's session by id. If already revoked, no-op
  (idempotent). Else `row.RevokedAtUtc = now`, `SaveChanges`.
- **RevokeMyOtherSessionsAsync**: `RevokeAllRefreshTokensAsync(userId, now, keptTokenHash:
  HashRefreshToken(currentRefreshToken), ct)` + `SaveChanges`. If `currentRefreshToken` is
  null/empty, keep nothing (revokes all) — but the caller always has the cookie, so current
  survives.
- **RevokeAllUserSessionsAsync**: `RevokeAllRefreshTokensAsync(targetUserId, now, keptTokenHash:
  null, ct)` + `SaveChanges` (admin is not logged in as target, so the target's current session
  is intentionally included) — **except** the calling admin's OWN impersonation session of this
  same target, which is spared. **Decided 2026-08-29** (was open in the original spec):
  `RevokeAllRefreshTokensAsync` gained a second, orthogonal exclusion —
  `spareImpersonationByUserId` — that skips any row where `ImpersonatedByUserId ==
  spareImpersonationByUserId`. `RevokeAllUserSessionsAsync` now takes `actingUserId` (from
  `User.GetUserId()` in the controller, NOT the route id) and passes it through. Rationale: an
  admin impersonating user X who lands on X's own profile is already `isSelf` and safely routed
  to the self-service "revoke others" path — but an admin who is impersonating X in ANOTHER
  tab/session while browsing X's profile as themselves in THIS one would otherwise sever their
  own working impersonation session with this button. `RevokeUserSessionAsync` (single-session,
  explicit id) is unaffected — picking one exact row to kill, including an impersonation one, is
  an intentional act, not a blanket sweep.

### 4.4 Controllers

`ATTours.ClientAPI/Controllers/AuthController.cs` — EDIT (class is `[AllowAnonymous]`; each new
action adds `[Authorize]`, exactly like `MyPermissionsAsync`). Read the cookie via
`Request.Cookies[RefreshTokenCookie.Name]`, `userId` via `User.GetUserId()`:
```
[HttpGet]  [Route("Sessions")]                [Authorize]  GetMySessionsAsync → authService.GetMySessionsAsync(User.GetUserId(), Request.Cookies[RefreshTokenCookie.Name], ct)
[HttpDelete] [Route("Sessions/{id:int}")]     [Authorize]  RevokeMySessionAsync(int id) → authService.RevokeMySessionAsync(User.GetUserId(), id, ct); NoContent
[HttpPost] [Route("Sessions/RevokeOthers")]   [Authorize]  RevokeMyOtherSessionsAsync → authService.RevokeMyOtherSessionsAsync(User.GetUserId(), Request.Cookies[RefreshTokenCookie.Name], ct); NoContent
```

`ATTours.ClientAPI/Controllers/UsersController.cs` — EDIT (mirror the `LoginHistory` endpoint;
reuse `RequiresPermission(AdminScreens.Users, …)` — `View` for read, `Update` for mutation, per
`ChangeRole`):
```
[HttpGet]    [Route("{id:int}/Sessions")]                 [RequiresPermission(Users, View)]   GetUserSessionsAsync(int id) → authService.GetUserSessionsAsync(id, ct)
[HttpDelete] [Route("{id:int}/Sessions/{sessionId:int}")] [RequiresPermission(Users, Update)] RevokeUserSessionAsync(int id, int sessionId) → authService.RevokeUserSessionAsync(id, sessionId, ct); NoContent
[HttpPost]   [Route("{id:int}/Sessions/RevokeAll")]       [RequiresPermission(Users, Update)] RevokeAllUserSessionsAsync(int id) → authService.RevokeAllUserSessionsAsync(id, User.GetUserId(), ct); NoContent
```
`UsersController` already injects `IAuthService` — no new ctor dependency.

---

## 5. Out of scope (do NOT build)
- No public `/account` session UI decisions here (frontend is a separate task); this spec is
  backend contract only.
- No SuperAdmin escalation guard on admin session-revoke beyond the existing `RequiresPermission`
  gate (revoking sessions is not privilege escalation; unlike `ChangeRole`).
- No absolute session cap / max-device-count enforcement.
- No new `GlobalErrorCode` — reuse `RelationalEntityNotFound` (404) for ownership failures and
  `RefreshTokenInvalid` (401) for the grace-branch rejects.
- No change to cookie handling, `IssuedRefreshToken`, or `RefreshTokenCookie`.
- No walking the replacement chain beyond a single hop (ADR 033).
