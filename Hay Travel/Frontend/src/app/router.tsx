import { createBrowserRouter, replace } from 'react-router'
import { RootLayout } from './layout/RootLayout'
import { NotFoundPage } from './layout/NotFoundPage'
import { RouteErrorBoundary } from './layout/RouteErrorBoundary'

/**
 * Routing: React Router v8 "data mode" (`createBrowserRouter` + `RouterProvider`).
 *
 *  - `route.lazy` gives per-page code splitting with zero extra bundler config. It matters
 *    here: the map ships ~40KB of province geometry, which must not sit in the initial bundle
 *    for visitors who never open it.
 *  - Route `loader`s fetch data before render and re-run when the URL changes. Catalog filters
 *    live in the query string (`useTourFilters`), so filtering needs no loader re-run.
 *  - The catalog is ONE canonical page, `/trips` ("Путешествия"). Tours and excursions are the
 *    same list narrowed by `?kind`; the route never pre-filters it. `/tours` and `/excursions`
 *    are kept alive as loader redirects (see below) because those links were shared publicly.
 *  - `shared/api/tours.ts` talks to the real backend (stage 5); loaders, components and this
 *    tree don't know or care.
 *  - The detail route is `tours/:id`, not `tours/:slug`: `Tour` has no `Slug` field on the
 *    backend (adding one needs a migration, out of scope for now — see `docs/backend-stage3-sync.md`),
 *    so the public detail page is addressed the same way the admin one already is.
 *
 * Deploy note: renders entirely client-side (no SSR). `netlify.toml` adds the SPA fallback
 * redirect so deep links like `/tours/42` work on direct load or refresh — the same fallback is
 * what makes the redirects below work on a cold visit to an old URL.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        lazy: () =>
          import('@/features/home').then((m) => ({ Component: m.HomePage, loader: m.homeLoader })),
      },
      {
        path: 'trips',
        lazy: () =>
          import('@/features/tours').then((m) => ({ Component: m.ToursPage, loader: m.toursLoader })),
      },
      // Legacy catalog URLs, kept alive because they were shared publicly. These are
      // redirect-only routes: a `loader` and no component, so nothing ever renders here.
      // Each one reproduces what its old URL actually showed, so a bookmark lands on the
      // same view it used to:
      //   `/tours`      — rendered the WHOLE catalog ("Все маршруты"), not only tours, so it
      //                   must NOT gain `?kind=tour`.
      //   `/excursions` — was locked to excursions regardless of the query string.
      // Any other filters already lived in the query string, so they carry over untouched.
      // `replace()` rather than `redirect()`: the legacy URL must not stay in history, or Back
      // would land on it and bounce the visitor forward again.
      {
        path: 'tours',
        loader: ({ request }) => replace(`/trips${new URL(request.url).search}`),
      },
      {
        path: 'excursions',
        loader: ({ request }) => {
          const params = new URLSearchParams(new URL(request.url).search)
          params.set('kind', 'excursion')
          return replace(`/trips?${params}`)
        },
      },
      {
        path: 'tours/:id',
        lazy: () =>
          import('@/features/tours').then((m) => ({
            Component: m.TourDetailPage,
            loader: m.tourDetailLoader,
          })),
      },
      {
        path: 'regions',
        lazy: () =>
          import('@/features/regions').then((m) => ({
            Component: m.RegionsPage,
            loader: m.regionsLoader,
          })),
      },
      // Auth lives under one `/auth` prefix. `AuthPage` itself is three states (login tabs /
      // sign-up tabs / "you are already signed in"), the rest are steps of the email flows.
      {
        path: 'auth',
        lazy: () => import('@/features/auth').then((m) => ({ Component: m.AuthPage })),
      },
      {
        path: 'auth/check-email',
        lazy: () => import('@/features/auth').then((m) => ({ Component: m.CheckEmailPage })),
      },
      {
        path: 'auth/verify',
        lazy: () => import('@/features/auth').then((m) => ({ Component: m.VerifyEmailPage })),
      },
      {
        path: 'auth/forgot-password',
        lazy: () => import('@/features/auth').then((m) => ({ Component: m.ForgotPasswordPage })),
      },
      {
        path: 'auth/reset-password',
        lazy: () => import('@/features/auth').then((m) => ({ Component: m.ResetPasswordPage })),
      },
      {
        path: 'auth/change-password',
        lazy: () => import('@/features/auth').then((m) => ({ Component: m.ChangePasswordPage })),
      },
      // `/login` was the old URL of the (presentation-only) auth screen and may be bookmarked.
      // Redirect-only route, same pattern as `/tours` above: `replace` keeps it out of history so
      // Back doesn't bounce forward again. The query string carries over, so a `?returnTo=` on an
      // old link still works.
      {
        path: 'login',
        loader: ({ request }) => replace(`/auth${new URL(request.url).search}`),
      },
      // The backend builds its email links from `Email:VerifyUrlBase` / `Email:ResetUrlBase`,
      // which are configured as `<site>/verify-email` and `<site>/reset-password` (+ `?token=`) —
      // NOT the `/auth/*` paths above. Rather than change deployed backend configuration (and
      // break every link already sitting in someone's inbox), those two URLs are kept alive as
      // redirects that carry the query string through untouched.
      {
        path: 'verify-email',
        loader: ({ request }) => replace(`/auth/verify${new URL(request.url).search}`),
      },
      {
        path: 'reset-password',
        loader: ({ request }) => replace(`/auth/reset-password${new URL(request.url).search}`),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: 'admin',
    // Everything admin is code-split behind this one lazy import — including the error
    // boundary (provided as `ErrorBoundary` here rather than a static `errorElement`, which
    // would statically pull the whole admin feature into the main bundle and defeat the split).
    lazy: () =>
      import('@/features/admin').then((m) => ({
        Component: m.AdminLayout,
        loader: m.adminRootLoader,
        ErrorBoundary: m.AdminErrorBoundary,
      })),
    children: [
      {
        index: true,
        lazy: () =>
          import('@/features/admin').then((m) => ({ Component: m.DashboardPage, loader: m.dashboardLoader })),
      },
      {
        path: 'products',
        lazy: () =>
          import('@/features/admin').then((m) => ({ Component: m.ProductsPage, loader: m.productsLoader })),
      },
      {
        path: 'catalog',
        lazy: () =>
          import('@/features/admin').then((m) => ({ Component: m.CatalogPage, loader: m.catalogLoader })),
      },
      {
        path: 'users',
        lazy: () =>
          import('@/features/admin').then((m) => ({ Component: m.UsersPage, loader: m.usersLoader })),
      },
      {
        path: 'settings',
        lazy: () =>
          import('@/features/admin').then((m) => ({ Component: m.SettingsPage, loader: m.settingsLoader })),
      },
      {
        path: 'tours/new',
        lazy: () =>
          import('@/features/admin').then((m) => ({ Component: m.TourCreatePage, loader: m.tourCreateLoader })),
      },
      {
        path: 'tours/:id/edit',
        lazy: () =>
          import('@/features/admin').then((m) => ({ Component: m.TourEditPage, loader: m.tourEditLoader })),
      },
    ],
  },
])
