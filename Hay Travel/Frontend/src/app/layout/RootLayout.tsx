import { Outlet, ScrollRestoration } from 'react-router'
import { Header } from './Header'
import { Footer } from './Footer'

/**
 * Public site shell.
 *
 * `main` intentionally has NO max-width or padding: the hero and the region map are
 * full-bleed, so each page section owns its own container. Constraining here would box in
 * the very elements meant to run edge to edge.
 */
export function RootLayout() {
  return (
    // Public palette is scoped here, not on `body` — `/admin` must stay on its own light shell.
    <div className="flex min-h-screen flex-col bg-page text-ink">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration />
    </div>
  )
}
