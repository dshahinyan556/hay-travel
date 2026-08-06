import { useEffect } from 'react'
import { getFaviconUrl } from '@/shared/api/siteSettings'

/**
 * Applies the admin-set favicon (`Настройки → SEO → faviconUrl`, F11) to the browser tab icon
 * once settings are fetched client-side.
 *
 * Independent of `netlify/edge-functions/seo-meta.ts`, which handles the same field for
 * messenger/crawler bots that never execute this JS at all (F10/B12) — this effect only matters
 * for real visitors' browser tabs. Mount once from `RootLayout` (public site only; `/admin`
 * never shows this icon to end users and keeps the static default).
 *
 * `seo.faviconUrl` may not exist in the backend catalog yet (B9 ships separately) — a blank or
 * missing value is a normal empty state, not an error, and this simply leaves the static
 * `<link rel="icon" href="/favicon.svg">` from `index.html` in place.
 */
export function useFavicon(): void {
  useEffect(() => {
    let cancelled = false
    getFaviconUrl().then((url) => {
      if (cancelled || !url) return
      const link =
        document.querySelector<HTMLLinkElement>('link[rel="icon"]') ??
        document.head.appendChild(document.createElement('link'))
      link.rel = 'icon'
      link.href = url
    })
    return () => {
      cancelled = true
    }
  }, [])
}
