import { Link, redirect, useLoaderData } from 'react-router'
import { InquiryScreenLayout } from '@/shared/ui'
import { AdminScreen, canView, ensurePermissionsReady } from '@/shared/auth'
import { firstVisibleAdminPath } from '@/features/admin/layout/adminNav'
import { getAllTours } from '@/features/admin/api/adminTours'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { TourThumb, TypeBadge, tourTitle } from '@/features/admin/ui/TourTableParts'
import type { TourInfoModel } from '@/shared/types/attours'
import { dashboardCopy } from './lib/dashboardCopy'
import { StatCards } from './components/StatCards'

/** How many of the most recent products the dashboard preview shows. */
const RECENT_LIMIT = 5

/**
 * Loads every active tour for the dashboard. Errors are NOT swallowed — a rejected
 * `getAllTours()` propagates to `AdminErrorBoundary`.
 *
 * Two permission subtleties live here, and both come from the dashboard being the INDEX route:
 *
 * 1. A role may exist without `dashboard.View`. Redirecting such a user to `/admin` — the usual
 *    refusal — would loop, because `/admin` IS this route. So they are sent to the first entry of
 *    the nav they can actually open. When there is none, this returns empty data instead of
 *    throwing: `adminRootLoader` has already decided to render «Недостаточно прав» for the same
 *    navigation, so `AdminLayout` never mounts the `<Outlet/>` and nobody sees this.
 * 2. `Tour/GetAll` is gated by `products.View`, a DIFFERENT key. A role with the dashboard but no
 *    products would 403 on the panel's home page, so the request is skipped: the counters read zero
 *    and the preview shows its existing empty state.
 */
export async function dashboardLoader() {
  await ensurePermissionsReady()

  if (!canView(AdminScreen.Dashboard)) {
    const fallback = firstVisibleAdminPath()
    if (fallback !== null && fallback !== '/admin') throw redirect(fallback)
    return { tours: [] }
  }

  const tours = canView(AdminScreen.Products) ? await getAllTours() : []
  return { tours }
}

/**
 * The dashboard is an at-a-glance overview only: summary counters plus a short preview of the
 * most recent products. It deliberately has no create button and no management actions — full
 * management (search, filters, archive, edit) lives on the Products page. This screen is a
 * placeholder for a richer dashboard to come.
 *
 * Template D — «Экран просмотра» (`InquiryScreenLayout`): read-only by definition, so the layout's
 * `controlZone` stays EMPTY here. It is not an omission — the archetype's control zone may only
 * hold scope controls (period chips, "данные на 14:32" + refresh), and this screen has none of
 * those yet; the "Все продукты →" affordance is a link into the screen that does have actions,
 * never a button of its own.
 */
export function DashboardPage() {
  const { tours } = useLoaderData<typeof dashboardLoader>()
  const copy = useCopy(dashboardCopy)
  const isEmpty = tours.length === 0
  // Most recent first (higher id = created later).
  const recent = [...tours].sort((a, b) => b.id - a.id).slice(0, RECENT_LIMIT)

  return (
    <InquiryScreenLayout title={copy.title} subtitle={copy.subtitle}>
      <StatCards tours={tours} />

      {isEmpty ? (
        <div className="rounded-xl border border-neutral-200 bg-white px-6 py-14 text-center">
          <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
            <span
              aria-hidden="true"
              className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-2xl"
            >
              🧳
            </span>
            <h2 className="text-base font-semibold text-neutral-800">{copy.emptyTitle}</h2>
            <p className="text-sm text-neutral-500">{copy.emptyText}</p>
            <div className="mt-3">
              <Link to="/admin/products" className="text-sm font-semibold text-neutral-900 hover:underline">
                {copy.emptyLink}
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-neutral-900">{copy.recentTitle}</h2>
            <Link
              to="/admin/products"
              className="text-sm font-semibold text-neutral-900 transition-colors hover:underline"
            >
              {copy.allProducts}
            </Link>
          </div>
          <RecentList tours={recent} />
        </section>
      )}
    </InquiryScreenLayout>
  )
}

/** Read-only preview list of recent products; each row links to its edit page. */
function RecentList({ tours }: { tours: TourInfoModel[] }) {
  const copy = useCopy(dashboardCopy)
  // Read once here rather than per row: `tourTitle` is called inside the `.map()` below.
  const { locale } = useLocale()

  return (
    <ul className="flex flex-col divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
      {tours.map((tour) => {
        const { text: title, empty } = tourTitle(tour, locale)
        return (
          <li key={tour.id}>
            <Link
              to={`/admin/tours/${tour.id}/edit`}
              className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-neutral-50"
            >
              <TourThumb url={tour.mainImageUrl} alt={title} />
              <span className={`min-w-0 flex-1 truncate font-semibold ${empty ? 'text-neutral-400' : 'text-neutral-900'}`}>
                {title}
              </span>
              <TypeBadge type={tour.type} />
              <span
                className={`shrink-0 text-xs font-semibold ${
                  tour.isActive ? 'text-neutral-900' : 'text-neutral-400'
                }`}
              >
                {tour.isActive ? copy.published : copy.hidden}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
