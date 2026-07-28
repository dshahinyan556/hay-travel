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
 *  - When mocks are swapped for the real API, only `shared/api/tours.ts` changes — loaders,
 *    components and this tree stay put.
 *
 * Deploy note: renders entirely client-side (no SSR). `netlify.toml` adds the SPA fallback
 * redirect so deep links like `/tours/yug-armenii-tatev` work on direct load or refresh — the
 * same fallback is what makes the redirects below work on a cold visit to an old URL.
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
        path: 'tours/:slug',
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
      {
        path: 'login',
        lazy: () => import('@/features/auth').then((m) => ({ Component: m.AuthPage })),
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
