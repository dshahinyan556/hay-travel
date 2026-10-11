# ADR 033 — Refresh-token rotation grace period vs. reuse-detection nuke

Status: Accepted (2026-08-29)
Related: [029](029-remember-me-and-inactivity-as-sliding-refresh-token-expiry.md),
[030](030-instant-access-token-kill-on-impersonation.md), spec
[017](../specs/017-session-management-and-refresh-grace.md)

## Context
`AuthService.RefreshAsync` rotates the refresh token on every use and revokes the presented
one. The reuse-detection branch treats ANY presentation of an already-revoked token as chain
compromise and revokes the user's entire refresh-token family (all sessions, all devices).

That branch fires legitimately whenever two clients race the same ~15-minute access-token
expiry: device A rotates T1→T2, device B (a phone, a second browser) presents T1 a second or
two later, still holding the pre-rotation token. Result: both devices logged out everywhere.
A frontend Web Locks guard serialises refreshes within one browser, but cannot coordinate
across different devices/browsers, so a server-side defense is required for that residual case.

## Decision
Add a short **grace window** to the reuse-detection branch and split "revoked" into two
causes using the already-persisted `ReplacedByTokenHash`:

- `ReplacedByTokenHash != null` — the token died by **rotation**.
- `ReplacedByTokenHash == null` — the token died by **explicit kill** (logout, password
  change, revoke-one, revoke-others, revoke-all, impersonation flush).

Branch logic, in order:

1. **Forgivable rotation race** — `ReplacedByTokenHash != null`, presented within the grace
   window (`now - RevokedAtUtc <= 10s`), AND the immediate replacement row (single hop, looked
   up by `TokenHash == storedToken.ReplacedByTokenHash`) is still live (`RevokedAtUtc == null`
   and not expired). → forgive: mint a fresh rotation off the **live head** and hand it to the
   caller (catch-up), no family nuke.
2. **Explicit-kill token** — `ReplacedByTokenHash == null`. → the session was deliberately
   ended; reject with `RefreshTokenInvalid`, **no family nuke**. (Without this, a revoked-other
   or logged-out device presenting its own dead token would nuke the surviving/current session
   — directly breaking "revoke others keeps me in".)
3. **Genuine reuse** — rotated token presented outside the grace window, or whose replacement
   head is already dead. → keep the conservative behavior: nuke the whole family + reject.

### Why 10 seconds
Long enough to cover clock skew + a network round trip between two devices genuinely racing the
same expiry; far shorter than any realistic steal-then-replay gap (a stolen token surfaces
minutes+ later → falls into case 3). Tunable via a single `const`.

### Why single-hop only
A rotation race is always between adjacent generations (a token and its immediate successor). A
client two hops behind the live head is not racing — it is stale or replayed — and is correctly
handled by case 3. Single-hop keeps the query bounded and the security envelope tight.

### Accepted residual risk
An attacker who replays a stolen token *inside* the 10s window while the real head is live gets
forgiven and catches up alongside the victim (both ping-pong forward, both stay in). This is the
inherent cost of any grace window; the 10s bound keeps it tiny, frontend Web Locks removes the
same-browser variant, and the alternative (no grace) produces frequent real-world false-positive
mass logouts. Defense in depth, not a theft-proof guarantee.

## Consequences
- Explicit revoke (logout / revoke-others / revoke-all / password change) can never be undone by
  the grace path: those tokens have `ReplacedByTokenHash == null` and hit case 2, and their
  live-head check in case 1 fails once the head is explicitly revoked.
- Session-management "revoke others" (keeps current) is now safe from the family-nuke.
- **2026-08-29 addendum**: the catch-up mint (case 1) re-runs the same `IsDeleted` /
  `LockedUntil` / `IsEmailVerified` checks the normal rotation path already runs, before minting.
  Without this, those state changes landing inside the 10s window would not take effect on a
  forgiven caller until its NEXT rotation — narrow, but a real gap, closed on David's call.
- **2026-08-29 addendum**: unrelated to the grace path itself, but the same session ADR family —
  `AuthService.RevokeAllUserSessionsAsync` (spec 017 §4) now spares the calling admin's own
  impersonation session of the target user, via a new `spareImpersonationByUserId` parameter on
  the shared `RevokeAllRefreshTokensAsync` helper. See spec 017 §4.3 for the rationale.
