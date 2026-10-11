/**
 * Loader for the top-level `/admin` route (see `app/router.tsx`) — the panel's single auth gate.
 *
 * Every admin page is nested under this route, so one check here covers the whole tree. Reading
 * the session from a loader is exactly why the auth store lives outside React (ADR 007): loaders
 * run before any component mounts and have no access to a context.
 *
 * Two failure modes, deliberately different:
 *  - NOT signed in → redirect to `/auth` carrying `returnTo`, so the visitor lands back on the
 *    page they asked for. There is nothing to see here for them.
 *  - signed in but without panel access (a `Regular` customer) → NOT a redirect. Bouncing them to
 *    a login screen they are already past reads as a bug; they get `AdminAccessDenied` rendered
 *    in place instead, with a way out.
 *
 * Section-level permissions (catalog, settings, users) are NOT checked here — each of those
 * loaders checks its own, so that typing a URL for a section you may not open lands on the
 * dashboard rather than throwing a raw 403 into `AdminErrorBoundary`.
 *
 * This is also where the resolved permission matrix is first fetched (ADR 024). Its failure is a
 * LOADING error, not a permission one: it propagates to `AdminErrorBoundary` («Не удалось
 * загрузить» + «Повторить»). Silently showing an administrator "you have no rights" because of a
 * network blip would be the worst possible reading of the situation.
 */

import { redirect } from 'react-router'
import {
  ensureAuthReady,
  ensurePermissionsReady,
  getAuthState,
  hasAnyScreenAccess,
  refreshPermissions,
  type AuthUser,
} from '@/shared/auth'

export interface AdminRootData {
  /** True → `AdminLayout` renders the access-denied screen instead of the panel shell. */
  accessDenied: boolean
  user: AuthUser
}

export async function adminRootLoader({ request }: { request: Request }): Promise<AdminRootData> {
  // Live state after the wait — the value `ensureAuthReady()` resolves with is cached per page load
  // and can predate a refresh that has since failed or a login that has since happened.
  await ensureAuthReady()
  const state = getAuthState()
  const url = new URL(request.url)
  const returnTo = encodeURIComponent(`${url.pathname}${url.search}`)

  if (!state.user) {
    throw redirect(`/auth?returnTo=${returnTo}`)
  }

  // A forced password change outranks everything else: the account is usable only after it.
  if (state.forceChangePassword) {
    throw redirect(`/auth/change-password?returnTo=${returnTo}`)
  }

  let permissions = await ensurePermissionsReady()

  // «Недостаточно прав» is a verdict, so it is never rendered off a single read: a token refresh
  // racing this loader (another tab, another dev port sharing the cookie) can clear or blank the set
  // in between. One fresh re-read; if the session died meanwhile, that is a login, not a denial.
  if (!hasAnyScreenAccess(permissions)) {
    permissions = await refreshPermissions()
    const user = getAuthState().user
    if (!user) throw redirect(`/auth?returnTo=${returnTo}`)
    if (!hasAnyScreenAccess(permissions)) return { accessDenied: true, user }
  }

  return { accessDenied: false, user: state.user }
}
