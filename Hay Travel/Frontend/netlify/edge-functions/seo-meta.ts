/**
 * Netlify Edge Function — injects the admin-configured SEO settings
 * (`Настройки → SEO`, backend `SiteSettings/GetPublic`, group `Seo`) into the raw HTML `<head>`
 * before it reaches the client. Wired up in `netlify.toml`'s `[[edge_functions]]` block.
 *
 * WHY THIS EXISTS (checklist F10/B12): Hay Travel's public site is a client-only SPA —
 * `index.html` ships a static `<title>Hay Travel</title>` and no Open Graph tags at all.
 * Messenger/social crawlers (Telegram, WhatsApp, Facebook…) fetch that raw HTML and never
 * execute `main.tsx`, so nothing an admin sets in Settings ever reaches what a shared link
 * previews as. Real visitors, who do run the JS, are unaffected by this file — see `useFavicon`
 * (`src/shared/hooks/useFavicon.ts`) for the client-side favicon counterpart to F11.
 *
 * SCOPE: one global set of tags for every route (site title / description / og:image), not
 * per-page/per-tour metadata — that's exactly what F10/B12 asked for; `SiteSettings` has no
 * per-route content to draw from. A future per-tour OG image would need a second, path-aware
 * fetch in here, not a rework of this file's shape.
 *
 * RUNTIME: Netlify Edge Functions run on a Deno-based edge runtime, not Node — no `fs`, no npm
 * dependency resolution. Two API-surface decisions worth flagging explicitly (could not be
 * checked against Netlify's docs while writing this — no network access at the time):
 *  - HTML rewriting: `HTMLRewriter` is a Cloudflare Workers API, not a standard Deno global, and
 *    pulling in a WASM polyfill would be an external dependency. This uses plain regex/string
 *    replacement on the `<head>` instead — simpler, zero dependency risk. Tradeoff: it is not a
 *    real HTML parser (a `<head>` that had the literal string `</head>` inside an attribute
 *    value would confuse it), which cannot happen in our own `index.html`.
 *  - Caching: rather than depend on the unverified availability/semantics of Deno's `caches`
 *    Cache API on Netlify's specific edge runtime, this uses a module-scope variable as a
 *    best-effort micro-cache (see `cachedSeo` below) — guaranteed to work with the plain Fetch
 *    API, degrades safely to "fetch every time" if the isolate never stays warm.
 *
 * This cannot be exercised by the local Vite dev server — Edge Functions only run on an actual
 * Netlify deploy (or `netlify dev`, not part of this project's tooling). Treat this file as
 * reviewed-but-untested-in-place until the first real deploy.
 */

const SEO_SETTING_GROUP = 5 // ATTours.Common.Enums.SiteSettingGroup.Seo
// Crawlers never carry the visitor's persisted locale (that's a `localStorage` value on the
// public site, see `src/shared/lib/locale.ts`), so this always renders the site's default
// language — Russian, `DEFAULT_LOCALE` there. Good enough for a title/description/OG preview,
// which is a single "canonical" summary rather than the fully localized experience.
const DEFAULT_LANGUAGE_CODE = 1
const DEFAULT_FAVICON_PATH = '/favicon.svg'
const CACHE_TTL_MS = 60_000

interface SiteSeoValues {
  siteTitle: string
  metaDescription: string
  ogImageUrl: string
  faviconUrl: string
}

const EMPTY_SEO: SiteSeoValues = { siteTitle: '', metaDescription: '', ogImageUrl: '', faviconUrl: '' }

// Best-effort micro-cache: module-scope variables persist across invocations on a *warm* edge
// isolate, but there is no guarantee of a single warm instance across cold starts or multiple
// edge nodes/regions — this cuts *repeat* backend calls on a hot path without depending on an
// unverified caching primitive. Worst case on a miss is one extra fetch to
// `/api/SiteSettings/GetPublic`; it never breaks the page.
let cachedSeo: { values: SiteSeoValues; expiresAt: number } | null = null

async function fetchSeoValues(origin: string): Promise<SiteSeoValues> {
  const now = Date.now()
  if (cachedSeo && cachedSeo.expiresAt > now) return cachedSeo.values

  try {
    // Same-origin, through the site's own `/api/*` proxy (`public/_redirects`) rather than the
    // Azure URL directly — keeps the Azure hostname in exactly one place (that file already
    // documents why the proxy exists). Tradeoff: one extra hop (edge isolate -> Netlify's own
    // redirect resolution -> Azure) versus calling Azure straight from here; acceptable given
    // the 60s cache above, and it means this file never needs updating if the backend host
    // changes. Safe from recursing into this same edge function: `/api/*` is in this function's
    // `excludedPath` in `netlify.toml`.
    const url = `${origin}/api/SiteSettings/GetPublic?languageCode=${DEFAULT_LANGUAGE_CODE}&group=${SEO_SETTING_GROUP}`
    const res = await fetch(url)
    if (!res.ok) return EMPTY_SEO

    const body = (await res.json()) as { values?: Record<string, string> }
    const values = body.values ?? {}
    const resolved: SiteSeoValues = {
      siteTitle: values['seo.siteTitle'] ?? '',
      metaDescription: values['seo.metaDescription'] ?? '',
      ogImageUrl: values['seo.ogImageUrl'] ?? '',
      // Defensive: `seo.faviconUrl` (checklist B9) may not exist in the backend catalog yet — an
      // absent key comes back as `undefined` here, same as any other unknown key, never an error.
      faviconUrl: values['seo.faviconUrl'] ?? '',
    }
    cachedSeo = { values: resolved, expiresAt: now + CACHE_TTL_MS }
    return resolved
  } catch {
    // Network/parse failure: never block the page on a broken settings fetch.
    return EMPTY_SEO
  }
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Replaces an existing `<head>` tag matched by `matcher`, or appends `tagHtml` just before
 * `</head>` when nothing matches. Keeps this idempotent regardless of what `index.html` happens
 * to contain (works whether or not a given tag already exists there).
 */
function upsertHeadTag(html: string, matcher: RegExp, tagHtml: string): string {
  if (matcher.test(html)) return html.replace(matcher, tagHtml)
  return html.replace(/<\/head>/i, `    ${tagHtml}\n  </head>`)
}

function injectSeo(html: string, seo: SiteSeoValues, pageUrl: string): string {
  let result = html

  if (seo.siteTitle) {
    result = upsertHeadTag(
      result,
      /<title>[^<]*<\/title>/i,
      `<title>${escapeHtmlAttribute(seo.siteTitle)}</title>`,
    )
    result = upsertHeadTag(
      result,
      /<meta\s+property=["']og:title["'][^>]*>/i,
      `<meta property="og:title" content="${escapeHtmlAttribute(seo.siteTitle)}" />`,
    )
  }

  if (seo.metaDescription) {
    result = upsertHeadTag(
      result,
      /<meta\s+name=["']description["'][^>]*>/i,
      `<meta name="description" content="${escapeHtmlAttribute(seo.metaDescription)}" />`,
    )
    result = upsertHeadTag(
      result,
      /<meta\s+property=["']og:description["'][^>]*>/i,
      `<meta property="og:description" content="${escapeHtmlAttribute(seo.metaDescription)}" />`,
    )
  }

  if (seo.ogImageUrl) {
    result = upsertHeadTag(
      result,
      /<meta\s+property=["']og:image["'][^>]*>/i,
      `<meta property="og:image" content="${escapeHtmlAttribute(seo.ogImageUrl)}" />`,
    )
  }

  // og:url reflects the actual requested page — always set, not part of the cached settings
  // value, so a link to any route previews with its own canonical URL instead of whatever page
  // happened to warm the settings cache first.
  result = upsertHeadTag(
    result,
    /<meta\s+property=["']og:url["'][^>]*>/i,
    `<meta property="og:url" content="${escapeHtmlAttribute(pageUrl)}" />`,
  )

  // Only touch the favicon link when an admin actually set one — otherwise leave the static
  // `<link rel="icon" href="/favicon.svg">` from `index.html` exactly as-is (that IS the
  // documented fallback, no need to rewrite it to itself).
  if (seo.faviconUrl) {
    result = upsertHeadTag(
      result,
      /<link\s+rel=["']icon["'][^>]*>/i,
      `<link rel="icon" href="${escapeHtmlAttribute(seo.faviconUrl || DEFAULT_FAVICON_PATH)}" />`,
    )
  }

  return result
}

// Minimal structural type for the one piece of Netlify's Edge Function `context` argument this
// file actually calls. Deliberately not importing `@netlify/edge-functions`' real `Context`
// type: this file has zero npm/import-map dependencies by design (see file header); Netlify
// supplies the real object at runtime regardless of how it's typed here.
interface EdgeContext {
  next: () => Promise<Response>
}

export default async function seoMeta(request: Request, context: EdgeContext): Promise<Response> {
  const url = new URL(request.url)
  const acceptHeader = request.headers.get('accept') ?? ''
  const looksLikeStaticAsset = /\.[a-z0-9]+$/i.test(url.pathname) && !url.pathname.endsWith('.html')

  // Belt-and-suspenders on top of `netlify.toml`'s `excludedPath`: never touch non-document
  // requests (API calls, hashed JS/CSS bundles, images, etc.) — only the actual HTML document.
  if (looksLikeStaticAsset || !acceptHeader.includes('text/html')) {
    return context.next()
  }

  const response = await context.next()

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html')) return response

  const seo = await fetchSeoValues(url.origin)
  // Nothing set in Settings yet (or the fetch failed) — ship the original document untouched
  // rather than writing empty tags over the static defaults already in `index.html`.
  if (!seo.siteTitle && !seo.metaDescription && !seo.ogImageUrl && !seo.faviconUrl) {
    return response
  }

  const html = await response.text()
  const rewritten = injectSeo(html, seo, url.toString())

  // Content-Length on the original response no longer matches the rewritten body's byte length
  // — drop it so nothing downstream trusts a stale value; `Response` recomputes it as needed.
  const headers = new Headers(response.headers)
  headers.delete('content-length')

  return new Response(rewritten, { status: response.status, headers })
}

export const config = {
  path: '/*',
  excludedPath: [
    '/api/*',
    '/assets/*',
    '/placeholders/*',
    '/favicon.svg',
    '/robots.txt',
    '/sitemap.xml',
  ],
}
