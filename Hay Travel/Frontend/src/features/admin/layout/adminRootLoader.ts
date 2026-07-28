/**
 * Loader for the top-level `/admin` route (see `app/router.tsx`).
 *
 * Today it does nothing — but it is the single, deliberate seam where authorization will
 * be wired in. When the backend gains auth, this is the ONLY place to add the guard:
 * read the token, and on a missing/expired one bail out with
 * `throw redirect('/admin/login')`. Because every admin page is nested under this route,
 * one check here protects the whole panel; no per-page guard is needed.
 */
export async function adminRootLoader() {
  return null
}
