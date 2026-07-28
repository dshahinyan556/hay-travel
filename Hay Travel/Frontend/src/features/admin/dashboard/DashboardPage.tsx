import { Link, useLoaderData } from 'react-router'
import { getAllTours } from '@/features/admin/api/adminTours'
import { TourThumb, TypeBadge, tourTitleRu } from '@/features/admin/ui/TourTableParts'
import type { TourInfoModel } from '@/shared/types/attours'
import { StatCards } from './components/StatCards'

/** How many of the most recent products the dashboard preview shows. */
const RECENT_LIMIT = 5

/**
 * Loads every active tour for the dashboard. Errors are NOT swallowed — a rejected
 * `getAllTours()` propagates to `AdminErrorBoundary`.
 */
export async function dashboardLoader() {
  const tours = await getAllTours()
  return { tours }
}

/**
 * The dashboard is an at-a-glance overview only: summary counters plus a short preview of the
 * most recent products. It deliberately has no create button and no management actions — full
 * management (search, filters, archive, edit) lives on the Products page. This screen is a
 * placeholder for a richer dashboard to come.
 */
export function DashboardPage() {
  const { tours } = useLoaderData<typeof dashboardLoader>()
  const isEmpty = tours.length === 0
  // Most recent first (higher id = created later).
  const recent = [...tours].sort((a, b) => b.id - a.id).slice(0, RECENT_LIMIT)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-neutral-900">Дашборд</h1>
        <p className="text-sm text-neutral-500">Обзор: сводка по всем турам и экскурсиям агентства.</p>
      </header>

      <StatCards tours={tours} />

      {isEmpty ? (
        <div className="rounded-xl border border-neutral-200 bg-white px-6 py-14 text-center">
          <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
            <span
              aria-hidden="true"
              className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-2xl"
            >
              🧳
            </span>
            <h2 className="text-base font-semibold text-neutral-800">Пока нет ни одной позиции</h2>
            <p className="text-sm text-neutral-500">
              Создайте первый продукт на странице «Продукты» — он появится здесь и на сайте.
            </p>
            <div className="mt-3">
              <Link to="/admin/products" className="text-sm font-semibold text-brand-700 hover:text-brand-800">
                Перейти в «Продукты» →
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-neutral-900">Недавние продукты</h2>
            <Link
              to="/admin/products"
              className="text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
            >
              Все продукты →
            </Link>
          </div>
          <RecentList tours={recent} />
        </section>
      )}
    </div>
  )
}

/** Read-only preview list of recent products; each row links to its edit page. */
function RecentList({ tours }: { tours: TourInfoModel[] }) {
  return (
    <ul className="flex flex-col divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
      {tours.map((tour) => {
        const { text: title, empty } = tourTitleRu(tour)
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
                  tour.isActive ? 'text-brand-700' : 'text-neutral-400'
                }`}
              >
                {tour.isActive ? 'На сайте' : 'Скрыт'}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
