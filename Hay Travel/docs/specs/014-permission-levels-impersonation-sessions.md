# Spec 014 — Access levels, impersonation, remember-me & inactivity

Status: ready for implementation
Author: Backend Architect
Related ADRs: [027](../adr/027-access-levels-replace-independent-crud-flags.md),
[028](../adr/028-impersonation-via-authservice-kills-impersonator-session.md),
[029](../adr/029-remember-me-and-inactivity-as-sliding-refresh-token-expiry.md),
[030](../adr/030-instant-access-token-kill-on-impersonation.md)

Addendum (2026-08-22): §8 adds an instant access-token kill on impersonation, resolving open
risk §7.2. Read §3 and §8 together — §8 is not optional; it ships with the impersonation path.

This spec is the implementation contract for four coupled changes to the auth/permission
system. All four ship together (they touch the same entities, DTOs, resolver and token
issuance). Orient on the existing flexible-roles vertical slice:
`RolePermission` / `UserPermissionOverride` → `PermissionResolutionService` →
`JwtTokenService` → `PermissionClaims` → `RequiresPermissionAttribute` /
`ClaimsPrincipalExtensions`, and the session vertical: `AuthService` (Login/Refresh/Logout)
→ `RefreshToken` → `AuthController` cookie handling.

Important context: the flexible-roles permission tables were introduced by the **uncommitted,
never-deployed** migrations `20260822090639_AddFlexibleRolesAndPermissions` and
`20260822145546_RemoveRoleSystemLockAddCanManageAdmins`. There is **no production data** in
the 4-bool columns. See §1.7 for the migration strategy that this fact enables.

---

## Section 1 — Level-based permission model (replaces 4 independent bools)

### 1.1 New enum — `AccessLevel`
Create `Hay Travel/Backend/ATTours.Common/Enums/AccessLevel.cs`:

```csharp
namespace ATTours.Common.Enums
{
    // Единый уровень доступа к «экрану» админки. Порядок значений = иерархия:
    // каждый уровень включает всё, что ниже (Delete => Update+Create+View).
    // Числа СОВПАДАЮТ с PermissionAction (View=1..Delete=4), поэтому «выданный уровень
    // покрывает требуемое действие» сводится к grantedLevel >= (int)requiredAction.
    public enum AccessLevel
    {
        None = 0,
        View = 1,
        Create = 2,
        Update = 3,
        Delete = 4
    }
}
```

`PermissionAction` (View=1..Delete=4, no None) stays **unchanged** — it is the *demand* side
(what an endpoint requires), used by ~40 `[RequiresPermission(...)]` attributes on
controllers. `AccessLevel` is the *grant* side (what a role/user has on a screen). Do **not**
touch the controller attributes.

### 1.2 `AdminScreens` — add level helpers
In `Hay Travel/Backend/ATTours.Common/Authorization/AdminScreens.cs`, add:

```csharp
// Наивысшее применимое к экрану действие, не превышающее level. Обрезает переданный
// уровень до того, что экран реально поддерживает — закрывает и «хвостовые», и
// «внутренние» пробелы (у calendar нет Update между Create и Delete).
// Возвращает None, если ни одно применимое действие не проходит по уровню.
public static AccessLevel CapLevel(string key, AccessLevel level)
{
    if (level == AccessLevel.None) return AccessLevel.None;
    var def = Find(key);
    if (def is null) return AccessLevel.None;

    AccessLevel capped = AccessLevel.None;
    foreach (var action in def.Actions)
        if ((int)action <= (int)level && (int)action > (int)capped)
            capped = (AccessLevel)(int)action;
    return capped;
}

// Уровень допустим для записи в матрицу, только если он None или ТОЧНО одно из
// применимых действий экрана (нельзя выдать Update у catalog.regions).
public static bool IsAssignableLevel(string key, AccessLevel level)
    => level == AccessLevel.None || CapLevel(key, level) == level;
```

`ScreenDefinition`, the `All` registry and `Actions` lists stay as they are — `Actions` now
doubles as "which levels are offered in the matrix dropdown, above None".

### 1.3 Entities
`Hay Travel/Backend/ATTours.Common/Entities/RolePermission.cs` — **change**: drop the four
`bool CanView/CanCreate/CanUpdate/CanDelete`, add:

```csharp
public AccessLevel Level { get; set; }   // None = нет доступа (раньше: все флаги false / нет строки)
```

`Hay Travel/Backend/ATTours.Common/Entities/UserPermissionOverride.cs` — **change**: drop the
four `bool?`, add:

```csharp
public AccessLevel? Level { get; set; }  // null = наследовать от роли; значение перекрывает роль
```

### 1.4 EntityConfiguration
`RolePermissionConfiguration.cs` / `UserPermissionOverrideConfiguration.cs` — remove any
per-bool property config; map `Level` as a required `int` (EF stores the enum as int) with
default `0` (None). Keep the existing unique indexes `(RoleId, ScreenKey)` /
`(UserId, ScreenKey)`. The override `Level` column is nullable.

### 1.5 Resolver — `PermissionResolutionService.ResolveAsync`
`Hay Travel/Backend/ATTours.Service/Services/Authorization/PermissionResolutionService.cs`.
Per screen:

```
raw    = override?.Level ?? role?.Level ?? AccessLevel.None
level  = AdminScreens.CapLevel(definition.Key, raw)   // defensive cap for dirty/over-granted rows
```

Emit `ResolvedScreenPermission { ScreenKey, Level }`. `BuildSuperAdminSet` emits, per screen,
`Level = CapLevel(key, AccessLevel.Delete)` (i.e. the screen's highest applicable action).
The `IsAdmin` flag on `ResolvedPermissionSet` is unchanged (SuperAdmin bypass).

### 1.6 DTOs (`ATTours.Common/DTO/Authorization`)
Replace the 4-bool shapes with a single level. This is a **breaking contract change** for the
admin Roles/Users matrix UI (checkboxes → level dropdown) — frontend must change in lockstep
(out of scope here, tracked as a separate frontend spec).

- `ResolvedPermissionSet.cs` → `ResolvedScreenPermission { string ScreenKey; AccessLevel Level; }`
- `RoleInfoModel.cs` → `ScreenPermissionModel { string ScreenKey; AccessLevel Level; }`
- `RoleSaveModel.cs` → uses the same `ScreenPermissionModel`; add `bool CanImpersonate` (see §2).
- `UserPermissionOverrideSaveModel.cs` → `ScreenOverrideModel { string ScreenKey; AccessLevel? Level; }`
- `MyPermissionsModel.cs` → `MyScreenPermissionModel { string ScreenKey; AccessLevel Level; }`
- `ScreenDefinitionModel.cs` (GET api/Screens) → **unchanged**; `Actions: List<PermissionAction>`
  still drives which levels the dropdown offers.

### 1.7 JWT claim encoding — `PermissionClaims`
`Hay Travel/Backend/ATTours.Common/Authorization/PermissionClaims.cs`. One level letter per
screen (was a `V`+subset string). Screens resolving to `None` are omitted entirely (absence =
no access), same as today's `CanView=false` omission.

- Letters: `N`(never emitted) / `V` / `C` / `U` / `D`, exactly one per screen.
- Example claim: `"dashboard:V;products:U;catalog.tags:V"` — `products:U` = level Update
  (implies View+Create+Update).
- `Encode(ResolvedPermissionSet)` → for each screen with `Level >= View`, append
  `"{ScreenKey}:{letter(Level)}"`.
- `Parse(raw)` → `Dictionary<string, AccessLevel>` (unknown/garbage letter → skip that entry;
  never throws — a broken claim means "no rights", never a 500).
- `Allowed(IReadOnlyDictionary<string, AccessLevel> parsed, string screenKey, PermissionAction action)`
  → `parsed.TryGetValue(screenKey, out var level) && (int)level >= (int)action`.
- The `Allowed(ResolvedScreenPermission, PermissionAction)` overload → `(int)screen.Level >= (int)action`.
- Keep `IsAdminClaimType = "is_admin"` and `TrueValue` as-is. Add the impersonate claim
  constant (see §2.3).

### 1.8 Enforcement — `ClaimsPrincipalExtensions` / attributes
`Hay Travel/Backend/ATTours.ClientAPI/Extensions/ClaimsPrincipalExtensions.cs`:
`HasPermission(principal, screenKey, action)` — unchanged shape; internally uses the new
`Parse` (→ `Dictionary<string, AccessLevel>`) and `Allowed`. `IsSystemAdmin()` bypass
unchanged. `RequiresPermissionAttribute` / `RequiresAnyPermissionAttribute` — **no change**
(they call `HasPermission` with a `PermissionAction`; the `>=` comparison lives inside
`PermissionClaims.Allowed`). Note: §8 adds a revocation pre-check to these attributes — that is
orthogonal to the level-comparison change here and does not alter `HasPermission`.

### 1.9 Validation
`RoleCreationService` / `RoleUpdateService` (matrix write) and
`UserPermissionOverrideUpdateService` (override write): for every submitted row reject with
`GlobalErrorCode.UnknownScreenKey` if `!AdminScreens.IsKnown(ScreenKey)`, and reject with a
new `GlobalErrorCode.InvalidPermissionLevel` (see §5) if
`!AdminScreens.IsAssignableLevel(ScreenKey, level)` (for overrides: only when `Level != null`).
An override row whose `Level` is `null` is dropped (inherit), same rule as today's "all-null".

### 1.10 AutoMapper
`Hay Travel/Backend/ATTours.ClientAPI/Mapper/MappingProfile.cs`: update the
`RolePermission`↔`ScreenPermissionModel`, `UserPermissionOverride`↔`ScreenOverrideModel`,
`ResolvedScreenPermission`→`MyScreenPermissionModel` maps from 4-bool member maps to the single
`Level` member. Remove the now-dead bool member maps.

### 1.11 Migration (see ADR 027 §Consequences)
Because the 4-bool columns exist only in **uncommitted, undeployed** migrations:

**Chosen path — edit in place.** Modify `20260822090639_AddFlexibleRolesAndPermissions`
(and its snapshot) so `RolePermission`/`UserPermissionOverride` are created with the `Level`
column directly, never the 4 bools. Regenerate the model snapshot. Local dev DBs must be
reset (drop + re-migrate) — acceptable, this is pre-production and the dev DB is disposable.
Do **not** author a data-collapse migration for production; there is nothing to collapse.

**Reference collapse rule** (for any developer who already applied the 4-bool migration
locally and wants to convert without dropping the DB — *not* shipped as a migration):
- `RolePermission`: `Level = CanDelete ? 4 : CanUpdate ? 3 : CanCreate ? 2 : CanView ? 1 : 0`
  ("highest true flag"; an invalid combo like Update-without-Create widens up to Update — this
  is the deliberate, owner-approved collapse — then `CapLevel` at resolution keeps it valid).
- `UserPermissionOverride`: `Level = (all four null) ? NULL : CanView == false ? 0 :
  CanDelete==true ? 4 : CanUpdate==true ? 3 : CanCreate==true ? 2 : CanView==true ? 1 : NULL`.
  The residual ambiguous case (only explicit-`false` on a non-View flag, View not false) →
  `NULL` (inherit). Overrides are documented as normally empty; run
  `SELECT COUNT(*) FROM UserPermissionOverride` first — expected 0, making the ambiguity moot.

---

## Section 2 — `Users.Impersonate` privilege (per-role, not a CRUD level)

Impersonation is a cross-cutting privilege, not a screen action — it does not fit the level
ladder. Model it **exactly like the existing `UserRole.CanManageAdmins`** privilege
(see ADR 028).

### 2.1 Entity
`Hay Travel/Backend/ATTours.Common/Entities/UserRole.cs` — add:

```csharp
// Может ли роль входить в аккаунт другого пользователя (feature «Войти как пользователь»,
// spec 014 §3). Не часть матрицы прав. Ставить/снимать флаг может ТОЛЬКО SuperAdmin —
// как и CanManageAdmins.
public bool CanImpersonate { get; set; }
```

`UserRoleConfiguration` — default `false` (bit NOT NULL default 0). New migration column.

### 2.2 DTOs
- `RoleSaveModel` — add `bool CanImpersonate`. Changing it vs the role's current value requires
  SuperAdmin (same `SuperAdminPrivilegeRequired`/403 guard already applied to `CanManageAdmins`
  in `RoleCreationService`/`RoleUpdateService`); a non-SuperAdmin who submits a changed value
  gets 403, not a silent ignore.
- `RoleInfoModel` — add `bool CanImpersonate` (read side, for the roles editor).

### 2.3 JWT claim
`PermissionClaims.cs` — add:

```csharp
public const string CanImpersonateClaimType = "can_impersonate";
```

`JwtTokenService.CreateAccessToken` — emit `new Claim(CanImpersonateClaimType, TrueValue)`
**only when** `user.Role?.CanImpersonate == true || user.IsSuperAdmin` (present-only-when-true,
same discipline as `is_admin`/`is_super_admin`). Role must be `Include`d — already true on all
issuance paths (Login/DevLogin/Refresh).

`ClaimsPrincipalExtensions.cs` — add:

```csharp
public static bool CanImpersonate(this ClaimsPrincipal principal)
    => string.Equals(principal?.FindFirstValue(PermissionClaims.CanImpersonateClaimType),
                     PermissionClaims.TrueValue, StringComparison.OrdinalIgnoreCase);
```

### 2.4 Enforcement attribute
Create `Hay Travel/Backend/ATTours.ClientAPI/Authorization/RequiresImpersonateAttribute.cs` —
same shape as `RequiresPermissionAttribute` (an `IAuthorizationFilter`): 401 if
unauthenticated, else `principal.CanImpersonate()` ? allow : `ForbidResult` (403). No DB hit —
reads the claim only. This keeps authorization out of the controller body. **Also consult the
§8 revocation registry first** (same pre-check as the other two permission filters).

---

## Section 3 — "Sign in as user" (impersonation)

One-way by design: there is **no** un-impersonate / "return to admin" endpoint. Ending an
impersonation session = normal logout → login screen (business requirement: admin cannot
silently go back). See ADR 028.

### 3.1 Entity — audit trail
Create `Hay Travel/Backend/ATTours.Common/Entities/ImpersonationEvent.cs`:

```csharp
[EntityTypeConfiguration(typeof(ImpersonationEventConfiguration))]
public class ImpersonationEvent : EntityBase
{
    public int ImpersonatorUserId { get; set; }
    public User Impersonator { get; set; }

    public int TargetUserId { get; set; }
    public User Target { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public string IpAddress { get; set; }   // nvarchar(64)
    public string UserAgent { get; set; }   // nvarchar(512)
}
```

Create `ImpersonationEventConfiguration` in
`ATTours.Common/Infrastructure/EntityConfiguration`: `ToTable(nameof(ImpersonationEvent))`;
two FKs to `User` (Impersonator, Target) both `OnDelete(DeleteBehavior.NoAction)` (users are
soft-deleted, and two cascade paths to one table are illegal in SQL Server); `IpAddress`
maxlen 64, `UserAgent` maxlen 512; index on `TargetUserId` and on `ImpersonatorUserId`.
Register `DbSet<ImpersonationEvent>` in `ATToursContext`. New migration creates the table.

### 3.2 Mark the impersonated session on the refresh token
So the "you are impersonating X" marker survives access-token rotation, store it on the
session row (see §4 for the other new `RefreshToken` field):

`RefreshToken.cs` — add:

```csharp
// Заполнено только у сессии, созданной импersonation'ом: id админа, который вошёл.
// Копируется при ротации (RefreshAsync). Null у обычных сессий. Аудит-указатель,
// не FK (полный аудит — в ImpersonationEvent).
public int? ImpersonatedByUserId { get; set; }
```

`RefreshTokenConfiguration` — map as nullable int, no FK/navigation. `JwtTokenService`
emits, when `ImpersonatedByUserId` is passed in, a claim `imp_by` = that id (add const
`ImpersonatedByClaimType = "imp_by"` in `PermissionClaims`). This requires threading the value
into `CreateAccessToken` — add an optional param `int? impersonatedByUserId = null`.

### 3.3 Service — `AuthService.ImpersonateAsync`
Add to `IAuthService` / `AuthService` (this is the single point where auth state changes —
it revokes sessions and issues tokens, exactly this method's job):

```csharp
Task<LoginOutcome> ImpersonateAsync(int actingUserId, int targetUserId,
    RequestContextModel requestContext, CancellationToken cancellationToken = default);
```

Logic (single transaction):
1. Load acting user (with Role) and target user (with Role). Acting user must exist.
2. **Guards** (throw the codes in §5):
   - target not found or `IsDeleted` → `RelationalEntityNotFound` (2003), 404.
   - `targetUserId == actingUserId` → `CannotImpersonateSelf` (2217), 400.
   - **Privilege-escalation guard**: if the acting user is **not** SuperAdmin, the target must
     be an "ordinary" account — reject with `ImpersonationTargetNotAllowed` (2218), 403, when
     `target.IsSuperAdmin || target.Role.CanManageAdmins || target.Role.CanImpersonate`.
     A SuperAdmin may impersonate anyone. (This stops a low-trust role with `CanImpersonate`
     from climbing to a SuperAdmin's account.)
3. Revoke **all** of the acting user's refresh tokens:
   `RevokeAllRefreshTokensAsync(actingUserId, now, keptTokenHash: null, ct)` — the admin's
   session ceases to exist server-side.
4. Issue a fresh session for the target: create a `RefreshToken` row with
   `UserId = targetUserId`, `RememberMe = false` (§4), `ImpersonatedByUserId = actingUserId`,
   `ExpiresAtUtc = now + InactivityWindow`.
5. Write one `ImpersonationEvent` (Impersonator=acting, Target=target, CreatedAtUtc=now, IP/UA
   from `requestContext`).
6. **Instant-kill the impersonator's access tokens (§8):** call
   `accessTokenRevocationRegistry.Revoke(actingUserId, cutoffUtc: now, entryExpiresUtc: now +
   TimeSpan.FromMinutes(settings.AccessTokenMinutes))` in the same transaction scope (the
   registry write is in-memory and non-transactional, but call it right after the revoke so
   there is a single logical "kill the admin" step). See §8 for the full contract.
7. `SaveChanges`; commit.
8. Build access token via
   `CreateAccessToken(target, ResolvePermissions(target), impersonatedByUserId: actingUserId)`.
9. Return `LoginOutcome(LoginResultModel{ AccessToken, ExpiresInSeconds, User=map(target),
   ForceChangePassword=false }, IssuedRefreshToken(...))`.

Rotation (`RefreshAsync`) must copy `ImpersonatedByUserId` (and `RememberMe`, §4) from the
stored token to the rotated token, and re-emit `imp_by` via
`CreateAccessToken(..., impersonatedByUserId: storedToken.ImpersonatedByUserId)`.

### 3.4 Endpoint — `POST api/Users/{id}/Impersonate`
On `UsersController` (route belongs to the users vertical; service is `AuthService`). Inject
`IAuthService` alongside `IMapper`:

```csharp
[HttpPost]
[Route("{id:int}/Impersonate")]
[RequiresImpersonate]                       // §2.4 — gate by can_impersonate claim
public async Task<LoginResultModel> ImpersonateAsync(int id, CancellationToken cancellationToken)
{
    // Целевой пользователь — ВСЕГДА из маршрута (IDOR-safe).
    var outcome = await authService.ImpersonateAsync(User.GetUserId(), id, BuildRequestContext(), cancellationToken);
    RefreshTokenCookie.Set(Response, outcome.RefreshToken, rememberMe: false);   // §4.4
    return outcome.Result;
}
```

`BuildRequestContext()` is currently private in `AuthController`. Extract the request-context
build + cookie set/clear into a shared helper so both controllers single-source the cookie
config (see §4.4). Response = `LoginResultModel`; the frontend swaps its in-memory session to
the target and reads `imp_by` from the token to show a "impersonating" banner.

### 3.5 Optional read endpoint (out of scope for this pass — note only)
A future `GET api/Users/{id}/ImpersonationHistory` (gate `users:View`) mapping
`ImpersonationEvent` to a small DTO can back an admin audit view. Not implemented now; the
entity + write path in §3.1/§3.3 are the in-scope deliverable.

### 3.6 Impersonator access-token lifetime — RESOLVED by §8
Earlier draft note (kept for history): "the impersonator's current access token is a stateless
JWT and cannot be revoked mid-flight — it stays valid until its ≤ `AccessTokenMinutes` (15 min)
TTL." **This is now closed.** §8 adds a scoped in-memory revocation registry that, on
`ImpersonateAsync` (§3.3 step 6), instantly invalidates every access token bearing the
impersonator's `sub` issued before the impersonation instant. Their refresh token is still
revoked and the cookie overwritten (as before); §8 additionally kills the stale access token on
its next permission-gated request. The impersonator can log back in as themselves normally (a
fresh token has a later `iat` and passes). See ADR 030.

---

## Section 4 — Remember-me + 1-hour inactivity

See ADR 029. Mechanism: the refresh token's `ExpiresAtUtc` already gates `RefreshAsync`
(`storedToken.ExpiresAtUtc <= now → invalid`). We make that expiry a **per-session sliding
window** whose length depends on remember-me. No new enforcement code — only the expiry
computation and carrying the flag through rotation change.

Current behavior (report): access token 15 min; refresh token 14 days, and **each rotation
issues a new 14-day token** → effectively a 14-day *sliding* session with no absolute cap and
no sub-14-day inactivity limit.

### 4.1 Settings
`Hay Travel/Backend/ATTours.Common/Settings/JwtSettings.cs` — add:

```csharp
public int InactivityMinutes => ReadInt(nameof(InactivityMinutes), 60);   // remember-me == false
```

`RefreshTokenDays` (14) remains the remember-me == true window. Add `"InactivityMinutes": 60`
to `appsettings.json` / `appsettings.Development.json` Jwt section (optional; default 60).

### 4.2 Entity
`RefreshToken.cs` — add (alongside §3.2's `ImpersonatedByUserId`):

```csharp
// Выбор «запомнить меня» на момент входа. true -> окно RefreshTokenDays (14д),
// false -> окно InactivityMinutes (1ч), скользящее по ротации. Копируется при ротации.
public bool RememberMe { get; set; }
```

`RefreshTokenConfiguration` — bit NOT NULL default 0.

### 4.3 Token creation & rotation
`IJwtTokenService.CreateRefreshToken()` → change to
`GeneratedRefreshToken CreateRefreshToken(bool rememberMe)`. Inside:
`lifetime = rememberMe ? TimeSpan.FromDays(settings.RefreshTokenDays)
                       : TimeSpan.FromMinutes(settings.InactivityMinutes)`;
`ExpiresAtUtc = DateTime.UtcNow + lifetime`.

`AuthService`:
- `LoginAsync` — read `model.RememberMe`; `CreateRefreshToken(model.RememberMe)`; store
  `RememberMe` on the row.
- `DevLoginAsync` — `rememberMe: false` (dev sessions are short).
- `RefreshAsync` — `CreateRefreshToken(storedToken.RememberMe)`; copy `RememberMe` (and
  `ImpersonatedByUserId`, §3.3) onto the rotated row. Each rotation slides the window forward
  from "now"; a non-remember session that goes > `InactivityMinutes` without a refresh has an
  expired refresh token, so the next `RefreshAsync` hits the existing
  `ExpiresAtUtc <= now → RefreshTokenInvalid` branch → user must log in again.
- `ImpersonateAsync` — `rememberMe: false` (§3.3).

### 4.4 DTO & cookie
`Hay Travel/Backend/ATTours.Common/DTO/Auth/LoginModel.cs` — add `bool RememberMe { get; set; }`
(default `false`).

Cookie lifetime must match: **non-remember → session cookie** (no `Expires`, cleared on
browser close) **+** 1-hour server sliding; **remember-me → persistent cookie** (`Expires` =
refresh `ExpiresAtUtc`, 14 d). Extract the cookie logic out of `AuthController` into a shared
static helper `Hay Travel/Backend/ATTours.ClientAPI/Authorization/RefreshTokenCookie.cs`
(single-sources cookie name/path/flags for `AuthController` + `UsersController`):

```csharp
public static class RefreshTokenCookie
{
    public const string Name = "att_refresh";
    public const string Path = "/api/Auth";
    public static void Set(HttpResponse res, IssuedRefreshToken token, bool rememberMe);  // Expires=null when !rememberMe
    public static void Clear(HttpResponse res);
    public static CookieOptions Options(DateTimeOffset? expires);   // HttpOnly, Secure, SameSite=Lax, Path, IsEssential
}
```

`AuthController.LoginAsync` passes `model.RememberMe` to `RefreshTokenCookie.Set`. On
`RefreshTokenAsync` the controller does not know remember-me before calling the service —
have `RefreshOutcome`/`LoginOutcome` carry the `RememberMe` flag out (or expose it on
`IssuedRefreshToken`) so the controller sets the cookie with the correct persistence. Add
`bool RememberMe` to `IssuedRefreshToken` and read it in the controller when setting the
cookie.

### 4.5 Existing-session flush (deliberate rollout side-effect)
The new-column migration (§4.2) must, in its `Up`, retrofit every existing `RefreshToken` row:
`RememberMe = 0` **and** `ExpiresAtUtc = CASE WHEN ExpiresAtUtc < DATEADD(minute, 60, GETUTCDATE())
THEN ExpiresAtUtc ELSE DATEADD(minute, 60, GETUTCDATE()) END` (clamp to ≤ now+1h). This turns
every live session into a 1-hour-inactivity session, so within an hour of deploy the whole user
base rotates through a fresh login and **flushes stale permission claims baked into old JWTs**.
This is the owner's intended side benefit, not incidental — call it out at deploy time
(expect a wave of re-logins within ~1 h). Remember-me is a **per-session** choice made at login;
there is **no** stored per-account "default remember-me" field (see §7 open item).

---

## Section 5 — New `GlobalErrorCode` values
`Hay Travel/Backend/ATTours.Helper/Enums/GlobalErrorCode.cs`. Append (do not reuse retired
numbers). In the EntityErrors block:
- `InvalidPermissionLevel = 2037` — "Permission level is not applicable to this screen."

In the AuthErrors block:
- `CannotImpersonateSelf = 2217` — "You cannot impersonate yourself."
- `ImpersonationTargetNotAllowed = 2218` — "You are not allowed to impersonate this user."

The missing-`can_impersonate`-claim case needs no code — the attribute returns 403 Forbid.
Target-not-found reuses `RelationalEntityNotFound` (2003), as `UsersController` already does.
A revoked access token (§8) needs no new code — the attribute returns 401.

---

## Section 6 — File checklist by project

**ATTours.Common**
- `Enums/AccessLevel.cs` — create.
- `Authorization/AdminScreens.cs` — add `CapLevel`, `IsAssignableLevel`.
- `Authorization/PermissionClaims.cs` — rewrite Encode/Parse/Allowed to level model; add
  `CanImpersonateClaimType`, `ImpersonatedByClaimType`.
- `Entities/RolePermission.cs` — 4 bools → `AccessLevel Level`.
- `Entities/UserPermissionOverride.cs` — 4 bool? → `AccessLevel? Level`.
- `Entities/UserRole.cs` — add `bool CanImpersonate`.
- `Entities/RefreshToken.cs` — add `bool RememberMe`, `int? ImpersonatedByUserId`.
- `Entities/ImpersonationEvent.cs` — create.
- `Infrastructure/EntityConfiguration/RolePermissionConfiguration.cs` — map `Level`.
- `Infrastructure/EntityConfiguration/UserPermissionOverrideConfiguration.cs` — map `Level`.
- `Infrastructure/EntityConfiguration/UserRoleConfiguration.cs` — map `CanImpersonate`.
- `Infrastructure/EntityConfiguration/RefreshTokenConfiguration.cs` — map new columns.
- `Infrastructure/EntityConfiguration/ImpersonationEventConfiguration.cs` — create.
- `DTO/Authorization/*` — ResolvedPermissionSet, RoleInfoModel, RoleSaveModel,
  UserPermissionOverrideSaveModel, MyPermissionsModel → level shapes; RoleSaveModel/RoleInfoModel
  add `CanImpersonate`.
- `DTO/Auth/LoginModel.cs` — add `bool RememberMe`.
- `DTO/Auth/` IssuedRefreshToken / LoginOutcome / RefreshOutcome — carry `RememberMe` out to the
  controller (add the field where these live).
- `Settings/JwtSettings.cs` — add `InactivityMinutes`.

**ATTours.Helper**
- `Enums/GlobalErrorCode.cs` — add 2037, 2217, 2218.
- `Security/IAccessTokenRevocationRegistry.cs` — create (§8).
- `Security/AccessTokenRevocationRegistry.cs` — create, in-memory singleton impl (§8).

**ATTours.Service (ATTours.BusinessServices)**
- `Security/JwtTokenService.cs` — `CreateAccessToken` emits `can_impersonate` + optional
  `imp_by`; `CreateRefreshToken(bool rememberMe)`.
- `Security/IJwtTokenService.cs` — signature changes.
- `Services/Authorization/PermissionResolutionService.cs` — resolve to `Level` + `CapLevel`.
- `Services/AuthServices/AuthService.cs` — Login/DevLogin/Refresh remember-me & rotation copy;
  add `ImpersonateAsync`; inject `IAccessTokenRevocationRegistry` and call `Revoke` in
  `ImpersonateAsync` (§3.3 step 6 / §8).
- `Services/AuthServices/IAuthService.cs` — add `ImpersonateAsync`.
- Role create/update + override update validation services — level validation + `CanImpersonate`
  SuperAdmin guard.

**ATTours.DataLayer**
- `ATToursContext.cs` — add `DbSet<ImpersonationEvent>`.
- Edit `Migrations/20260822090639_AddFlexibleRolesAndPermissions*` in place (level columns
  instead of bools) + regenerate snapshot (§1.11).
- New migration: `AddImpersonationAndRememberMe` — `UserRole.CanImpersonate`,
  `RefreshToken.RememberMe` + `ImpersonatedByUserId`, `ImpersonationEvent` table, and the §4.5
  existing-session flush `Up` SQL.

**ATTours.ClientAPI**
- `Authorization/RequiresImpersonateAttribute.cs` — create; revocation pre-check (§8).
- `Authorization/RequiresPermissionAttribute.cs` — add §8 revocation pre-check.
- `Authorization/RequiresAnyPermissionAttribute.cs` — add §8 revocation pre-check.
- `Authorization/RefreshTokenCookie.cs` — create (extract from AuthController).
- `Extensions/ClaimsPrincipalExtensions.cs` — add `CanImpersonate`; add
  `IsAccessTokenRevoked(registry)` (§8); `HasPermission` uses new Parse.
- `DependencyInjection/DependencyInjectionConfiguration.cs` — register
  `IAccessTokenRevocationRegistry` as a singleton (§8).
- `Controllers/AuthController.cs` — use `RefreshTokenCookie`; pass `RememberMe`.
- `Controllers/UsersController.cs` — inject `IAuthService`; add `Impersonate` endpoint.
- `Mapper/MappingProfile.cs` — level member maps; drop bool maps.
- `appsettings*.json` — optional `Jwt:InactivityMinutes`.

---

## Section 7 — Open risks / owner decisions
1. **Collapse widens invalid combos.** A legacy row `View+Update, no Create` becomes level
   `Update` (now implies Create). Since the tables are undeployed (§1.11) this only affects
   seeded/dev data, but confirm the "highest true flag" rule is acceptable for the seed.
2. **Impersonator access-token TTL gap — RESOLVED (see §8, ADR 030).** Was: the impersonator
   kept a working access token for ≤15 min after impersonating. David rejected accepting that
   window and required an instant kill. §8 delivers it via a scoped in-memory per-user
   revocation registry checked inside the permission attributes (no per-request DB check, no
   whole-pipeline redesign). No longer an open item.
3. **"Inactivity" == time since last refresh, not since last real click.** If the admin
   frontend proactively refreshes on a blind timer while a tab sits open-but-idle, a
   non-remember session would never hit the 1-hour limit. The 1-hour inactivity is only correct
   if the frontend refreshes **reactively** (on 401 / on real navigation), not on an idle
   timer. This is a cross-stack constraint the frontend must honor — confirm, or request the
   optional per-session last-activity hardening (rejected here for simplicity, see ADR 029).
4. **Remember-me is per-session, not a stored account preference.** The login checkbox defaults
   unchecked and is chosen each login; there is no `User`-level "default remember-me" column.
   The task's "default=false for all existing accounts via migration" is implemented as
   "existing *sessions* become non-remember + flushed" (§4.5). Confirm this interpretation.
5. **Privilege-escalation guard scope (§3.3 step 2).** A non-SuperAdmin impersonator is blocked
   from targets that are SuperAdmin / CanManageAdmins / CanImpersonate. Confirm that set is the
   right "elevated" boundary, or widen it (e.g. also block targets whose resolved permission set
   is a strict superset of the impersonator's — heavier, rejected here).
6. **Matrix UI is a breaking contract change (§1.6).** Roles/Users screens move from 4
   checkboxes to a single level dropdown; the frontend must ship in the same release or the
   admin matrix breaks. Sequence the frontend spec alongside.

---

## Section 8 — Instant access-token kill on impersonation (addendum, resolves §7.2)

See **ADR 030** for the "why". This section is the implementation contract. It ships with the
impersonation path (§3) — do not implement §3 without §8.

### 8.1 Problem restated
`ImpersonateAsync` (§3.3) revokes all the impersonator's refresh tokens, but access tokens are
stateless 15-min JWTs — nothing checks an issued access token against a denylist, so a stale
access token bearing the impersonator's `sub` (including one stashed in another tab/device
before impersonating) keeps working for up to `AccessTokenMinutes`. David requires an **instant
kill**. Constraint: do **not** add a per-request DB/cache check for every endpoint (keeps the
baked-claim design, ADR 011). Only impersonation needs this.

### 8.2 Mechanism — scoped in-memory per-user revocation registry
A process-wide singleton keyed by user id. One entry per impersonation event; each entry says
"reject `sub == userId` access tokens issued before `CutoffUtc`, until `EntryExpiresUtc`".

**What is stored:** `ConcurrentDictionary<int, RevocationEntry>` where
`RevocationEntry` is a small readonly struct/record `(DateTime CutoffUtc, DateTime EntryExpiresUtc)`.

**TTL:** `EntryExpiresUtc = CutoffUtc + AccessTokenMinutes` (≤15 min). After it, any token with
`iat < CutoffUtc` is already naturally expired, so the entry is dead weight → evicted. Eviction:
lazy on read (`now >= EntryExpiresUtc` ⇒ `TryRemove` and treat as absent) plus an opportunistic
sweep of expired entries on each `Revoke` write. **No background timer** — write volume is tiny.

**Storage location & topology:** in-memory, single-process. Deployment is a single backend
container (no replicas — `docs/server-ops.md` / `docker-compose.yml`). If the backend ever
scales to >1 replica, swap the implementation behind the same interface to `IDistributedCache`
/ Redis with the same key/value/TTL shape (see ADR 030). The interface exists now to make that
a one-class change.

### 8.3 Interface — `ATTours.Helper/Security/IAccessTokenRevocationRegistry.cs` (create)
Placed in `ATTours.Helper` because both `ATTours.Service` (writer: `AuthService`) and
`ATTours.ClientAPI` (reader: attributes) reference Helper, and Helper is the cross-cutting-infra
home. Contract:

```csharp
namespace ATTours.Helper.Security
{
    // Мгновенный отзыв access-токенов пользователя после impersonation (spec 014 §8, ADR 030).
    // In-memory, single-instance. Проверяется ТОЛЬКО в permission-атрибутах, не на каждом запросе.
    public interface IAccessTokenRevocationRegistry
    {
        // Быстрый путь для 99.9% запросов: пусто -> проверять нечего, парсить claim'ы не нужно.
        bool IsEmpty { get; }

        // Отозвать все access-токены пользователя, выпущенные до cutoffUtc, до entryExpiresUtc.
        // Вызывается ТОЛЬКО из AuthService.ImpersonateAsync (единственный триггер).
        void Revoke(int userId, DateTime cutoffUtc, DateTime entryExpiresUtc);

        // true, если для userId есть живая запись и токен выпущен (iat) до её CutoffUtc.
        // now берётся внутри (DateTime.UtcNow) для проверки живости записи.
        bool IsRevoked(int userId, DateTime tokenIssuedAtUtc);
    }
}
```

### 8.4 Implementation — `ATTours.Helper/Security/AccessTokenRevocationRegistry.cs` (create)
- Backed by `ConcurrentDictionary<int, RevocationEntry>`.
- `IsEmpty` ⇒ `dictionary.IsEmpty` (O(1), lock-free).
- `Revoke(userId, cutoffUtc, entryExpiresUtc)` ⇒ upsert (`AddOrUpdate`) keeping the **latest**
  `CutoffUtc` if an entry already exists (two impersonations in the window ⇒ the later cutoff
  wins); then opportunistically sweep entries whose `EntryExpiresUtc <= UtcNow`.
- `IsRevoked(userId, iat)` ⇒ `TryGetValue`; if none → `false`; if `UtcNow >= EntryExpiresUtc` →
  `TryRemove` + `false` (stale entry); else → `iat < CutoffUtc`.
- Thread-safe, no locks beyond what `ConcurrentDictionary` provides. Stateless w.r.t. config
  (caller passes `entryExpiresUtc`), so no `JwtSettings` dependency.

### 8.5 Writer — `AuthService.ImpersonateAsync` (§3.3 step 6)
- Inject `IAccessTokenRevocationRegistry` into `AuthService` (constructor DI — AuthService is
  the one auth vertical already on constructor DI, ADR 005). Add it to the existing ctor
  parameter list and backing field.
- In `ImpersonateAsync`, right after `RevokeAllRefreshTokensAsync(actingUserId, now, null, ct)`:
  `revocationRegistry.Revoke(actingUserId, cutoffUtc: now, entryExpiresUtc: now +
  TimeSpan.FromMinutes(JwtSettings.Instance.AccessTokenMinutes));` (`now` is the same UTC
  timestamp used for the revoke/audit row). The registry write is in-memory and outside the DB
  transaction — that is fine: if the DB commit fails the impersonation is aborted and the
  slightly-early registry entry only causes the admin's own stale tokens to 401 for ≤15 min
  (fail-safe direction, never grants extra access).

### 8.6 Reader — the three permission attributes
Add the revocation pre-check as the **first** step of `OnAuthorization` in all three, **before**
the `HasPermission` / `CanImpersonate` / `IsSystemAdmin` logic (the SuperAdmin bypass must not
skip revocation):

- `RequiresPermissionAttribute`
- `RequiresAnyPermissionAttribute`
- `RequiresImpersonateAttribute` (§2.4)

Attributes cannot take constructor DI, so resolve the singleton from `RequestServices`:

```csharp
// after the existing "not authenticated -> 401" guard:
var registry = context.HttpContext.RequestServices
    .GetRequiredService<IAccessTokenRevocationRegistry>();
if (context.HttpContext.User.IsAccessTokenRevoked(registry))
{
    context.Result = new UnauthorizedResult();   // 401 — must re-login as self
    return;
}
```

Revoked ⇒ `401 Unauthorized` (not 403): the token is dead, the client needs a new one. This is
consistent with the attributes' existing "unauthenticated → 401" branch.

### 8.7 Principal helper — `ClaimsPrincipalExtensions.IsAccessTokenRevoked`
Add to `Hay Travel/Backend/ATTours.ClientAPI/Extensions/ClaimsPrincipalExtensions.cs`:

```csharp
public static bool IsAccessTokenRevoked(this ClaimsPrincipal principal,
    IAccessTokenRevocationRegistry registry)
{
    // Быстрый путь: пока никто не impersonate'ил за последние <=15 мин, реестр пуст —
    // ни sub, ни iat не парсим, стоимость нулевая (см. ADR 030 / §8.2).
    if (registry.IsEmpty) return false;
    if (principal is null || !principal.TryGetUserId(out var userId)) return false;

    // iat обязателен на наших токенах. Если запись для userId живая, а iat непрочитаем —
    // fail-closed (считаем отозванным): наши токены всегда несут iat, отсутствие аномально,
    // приоритет instant-kill важнее лишнего одного релогина (ADR 030).
    if (!TryGetIssuedAtUtc(principal, out var issuedAtUtc))
        return registry.IsRevoked(userId, DateTime.MinValue);   // MinValue < любой Cutoff ⇒ revoked, если запись есть

    return registry.IsRevoked(userId, issuedAtUtc);
}

// iat — unix-секунды. Дефолтный inbound-map JwtBearer не переименовывает timestamp-claim'ы,
// читаем по стандартному имени "iat".
private static bool TryGetIssuedAtUtc(ClaimsPrincipal principal, out DateTime issuedAtUtc)
{
    issuedAtUtc = default;
    var raw = principal.FindFirstValue(JwtRegisteredClaimNames.Iat);
    if (!long.TryParse(raw, out var unixSeconds)) return false;
    issuedAtUtc = DateTimeOffset.FromUnixTimeSeconds(unixSeconds).UtcDateTime;
    return true;
}
```

Note the fail-closed branch: `registry.IsRevoked(userId, DateTime.MinValue)` is `true` iff a
live entry exists for `userId` (since `MinValue < CutoffUtc` always). So an unreadable `iat`
only 401s a user who is actually in the penalty window; everyone else still short-circuits on
`IsEmpty` / the missing-entry path.

### 8.8 DI registration
`DependencyInjectionConfiguration.AddServices`:
`services.AddSingleton<IAccessTokenRevocationRegistry, AccessTokenRevocationRegistry>();`
Singleton is mandatory — the whole point is a single shared in-memory table (correct because
single-instance; see §8.2).

### 8.9 `iat` invariant (acceptance check)
The mechanism relies on every issued access token carrying a readable `iat`. `JwtTokenService`
already produces one via `JwtSecurityToken` (which emits `iat`). Backend-developer must
**confirm** on a real issued token (decode it / inspect claims) that `iat` is present and that
JwtBearer options do not remap it away from `"iat"`. If a future config change disabled `iat`,
the fail-closed branch (§8.7) would 401 legitimate re-logins during a penalty window — so treat
`iat` presence as a load-bearing invariant, not incidental.

### 8.10 What §8 deliberately does NOT cover
- Endpoints gated **only** by `[Authorize]` / `[Authorize(Roles=…)]` without a permission
  attribute (meta screens, the Employee endpoint) are not revocation-checked. The stale-token
  threat is "keep performing admin actions as myself after impersonating", and every such action
  is behind a permission filter. Widening to the whole pipeline is explicitly out of scope
  (would reverse the "scope it to impersonation" instruction).
- No revocation on ordinary logout/refresh — those already invalidate the refresh token; §8 is
  only for the impersonation instant-kill. (Ordinary logout's stale access token remains a
  ≤15-min artifact, unchanged and out of scope for this task.)
- No persistence across process restart (unnecessary — a restart drops nothing that matters; a
  stale token still expires within its 15-min TTL and cannot be refreshed).

### 8.11 Acceptance — confirms David's "instant kill"
- Admin A (has `can_impersonate`) logs in on two tabs (two access tokens, same `sub=A`).
- Tab 1 calls `POST api/Users/{targetId}/Impersonate` → 200, now holds target's token.
- Tab 2, still holding A's original access token, calls any `[RequiresPermission]` admin
  endpoint → **401** immediately (not after 15 min). ✔ instant kill.
- Tab 2 re-logs-in as A → new token, `iat > cutoff` → admin endpoints work again. ✔ re-login
  path preserved.
- The impersonated target session (`sub=target`) is unaffected. ✔ no collateral.
