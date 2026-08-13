import { Outlet, ScrollRestoration } from 'react-router'
import { useRevalidateOnLocaleChange } from '@/shared/i18n/useRevalidateOnLocaleChange'
import { useFavicon, useSiteDesign } from '@/shared/hooks'
import { Header } from './Header'
import { Footer } from './Footer'
import { MobileTabBar } from './MobileTabBar'

/**
 * Public site shell.
 *
 * `main` intentionally has NO max-width or padding: the hero and the region map are
 * full-bleed, so each page section owns its own container. Constraining here would box in
 * the very elements meant to run edge to edge.
 *
 * `pb-24 lg:pb-0` on the root reserves room for the floating `MobileTabBar` below `lg` so it never
 * overlaps the footer's own bottom edge — the bar is fixed to the viewport, not the document flow,
 * so nothing else here shrinks to make space for it on its own.
 */
export function RootLayout() {
  // Public site only: `/admin` mounts its own layout, never this one.
  useRevalidateOnLocaleChange()
  // Admin-set favicon (F11) — real visitors only, see the hook's doc comment for the crawler
  // counterpart (`netlify/edge-functions/seo-meta.ts`).
  useFavicon()
  // Палитра-пресет + мягкий дефолт темы из админки (Spec 006). Публичный сайт только —
  // `/admin` живёт на своей светлой teal-палитре и пресеты игнорирует.
  useSiteDesign()

  return (
    // Public palette is scoped here, not on `body` — `/admin` must stay on its own light shell.
    // `leading-[1.62]` likewise: Manrope sets wider than Inter did and body copy needs the extra
    // air, but the admin panel's dense tables must NOT inherit it — they mount their own shell.
    <div className="flex min-h-screen flex-col bg-page pb-24 leading-[1.62] text-ink lg:pb-0">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <MobileTabBar />
      <ScrollRestoration />
    </div>
  )
}
