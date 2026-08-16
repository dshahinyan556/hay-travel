/**
 * Picks between an image's original URL and its WebP-compressed sibling based on the visitor's
 * connection, when the browser exposes that signal. Every image the backend serves via
 * `api/Upload/Image` always has a `.webp` sibling at the same path, same basename
 * (`ATTours.BusinessServices.Files.ImageUploadService`, ADR 2026-08-15) — this only ever matters
 * for uploaded images; externally-typed URLs (Unsplash etc.) have no such sibling and are
 * returned unchanged.
 */

const UPLOADED_IMAGE_PREFIX = '/uploads/'

interface NavigatorConnection {
  saveData?: boolean
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g'
}

interface NavigatorWithConnection extends Navigator {
  connection?: NavigatorConnection
}

function hasWebpSibling(url: string): boolean {
  return url.startsWith(UPLOADED_IMAGE_PREFIX)
}

function toWebpUrl(url: string): string {
  return url.replace(/\.[^./]+$/, '.webp')
}

/**
 * True when the visitor's connection is known to be slow or they've asked to save data.
 * `navigator.connection` (Network Information API) is Chromium/Android-only — Safari and Firefox
 * expose no such signal, so this returns false there and everyone gets the original. That's the
 * safe default: never swap to the lower-quality image without positive evidence of a slow
 * connection, rather than guessing.
 */
function prefersCompressed(): boolean {
  if (typeof navigator === 'undefined') return false
  const connection = (navigator as NavigatorWithConnection).connection
  if (!connection) return false
  if (connection.saveData) return true
  return connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g' || connection.effectiveType === '3g'
}

/** Returns the URL to actually put in `src`. The WebP-compressed sibling on a slow/data-saver
 * connection, the original otherwise — including for empty strings and any URL the backend
 * didn't generate a sibling for (external URLs typed into the admin by hand). */
export function adaptiveImageUrl(url: string): string {
  if (!url || !hasWebpSibling(url)) return url
  return prefersCompressed() ? toWebpUrl(url) : url
}
