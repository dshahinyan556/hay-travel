# ADR 029 — Remember-me and 1-hour inactivity as per-session sliding refresh-token expiry

Status: accepted (2026-08-22)
Context spec: [014](../specs/014-permission-levels-impersonation-sessions.md) §4

## Context
Login gains a "remember me" checkbox (default off, and default off retrofitted onto every
existing session). Unchecked sessions must require re-login after 1 hour of inactivity. Today
the refresh token is 14 days and **rotation re-issues a fresh 14-day token**, so a session is
effectively 14-day sliding with no shorter inactivity limit. The owner also wants the rollout to
flush stale permission claims baked into old JWTs faster across the whole user base.

## Decision
- Make the refresh token's `ExpiresAtUtc` a **per-session sliding window** whose length is
  `RefreshTokenDays` (14 d) when remember-me is on and `InactivityMinutes` (1 h) when off, set at
  issuance and re-set on every rotation. Persist the choice as `RefreshToken.RememberMe`, copied
  on rotation.
- **No new enforcement code.** `RefreshAsync` already rejects `ExpiresAtUtc <= now` — a
  non-remember session that goes an hour without a refresh simply fails that existing check.
- Cookie persistence matches: non-remember → **session cookie** (no `Expires`, dies on browser
  close) + 1 h server window; remember-me → persistent cookie (14 d).
- **Existing-session flush:** the migration sets every current `RefreshToken` to
  `RememberMe = 0` and clamps `ExpiresAtUtc` to ≤ now + 1 h, so within an hour of deploy the whole
  base re-logs-in and picks up fresh permission claims. This is the owner's intended side benefit.
- Remember-me is a **per-session** choice (stored on the token), not a stored per-account
  preference — there is no `User`-level column; the checkbox just defaults unchecked each login.

## Alternatives rejected
- **Per-user `LastActiveAtUtc` inactivity check** (reusing the B7 activity field). Rejected:
  `LastActiveAtUtc` is per-user, so activity on a remembered device would keep a non-remember
  session on another device alive (cross-session contamination). Available as optional hardening
  if §7.3 turns out to matter.
- **Absolute 1-hour cap regardless of activity.** Rejected: that logs active users out mid-work;
  the requirement is *inactivity*, which the sliding window models.
- **A stored account-level remember-me preference.** Rejected: remember-me is conventionally a
  per-login choice; a stored default adds a field with no clear product need.

## Consequences
- "Inactivity" == time since the last refresh call, not since the last real user click. Correct
  only if the frontend refreshes reactively (on 401 / real navigation), not on a blind idle timer
  — a cross-stack constraint (spec 014 §7.3).
- One-off wave of re-logins within ~1 h of deploy (the intended flush) — communicate at deploy.
- `IJwtTokenService.CreateRefreshToken` gains a `rememberMe` parameter; `LoginModel`,
  `IssuedRefreshToken` and the login/refresh outcomes carry the flag so the controller sets the
  right cookie persistence.
