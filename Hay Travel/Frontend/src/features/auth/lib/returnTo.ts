/**
 * `?returnTo=` — where to send the visitor once they are signed in.
 *
 * The value comes from the URL, so it is attacker-controllable: a link like
 * `/auth?returnTo=https://evil.example` would turn our own login screen into an open redirect
 * (phishing that starts on the real domain). Everything here exists to make that impossible —
 * only same-origin, path-relative destinations survive.
 */

const FALLBACK = '/'

/**
 * Accept a destination only if it is an in-app path.
 *
 * Rejected: absolute URLs (`https://…`), scheme-relative ones (`//evil.example`, which a browser
 * treats as absolute), backslash variants (`/\evil.example` — some parsers normalise `\` to `/`),
 * and anything not starting with `/`.
 *
 * @returns the safe path, or `'/'`.
 */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value) return FALLBACK
  if (!value.startsWith('/')) return FALLBACK
  if (value.startsWith('//') || value.startsWith('/\\')) return FALLBACK
  // `/auth…` as a destination would bounce the user back to the screen they just left.
  if (value === '/auth' || value.startsWith('/auth/') || value.startsWith('/auth?')) return FALLBACK
  return value
}

/** Read and sanitise `returnTo` from a location search string (`useLocation().search`). */
export function readReturnTo(search: string): string {
  return safeReturnTo(new URLSearchParams(search).get('returnTo'))
}

/** Append the CURRENT location as `returnTo` to an auth URL, e.g. for a "sign in" link that
 * should come back here afterwards. */
export function withReturnTo(path: string, returnTo: string): string {
  if (returnTo === FALLBACK) return path
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}returnTo=${encodeURIComponent(returnTo)}`
}
