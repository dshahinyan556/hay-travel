import { isRouteErrorResponse, useRouteError } from 'react-router'

/**
 * `errorElement` for the `/admin` route tree. Modelled on the public
 * `app/layout/RouteErrorBoundary.tsx`, but styled for the admin panel: it renders inside
 * the neutral work area without the public site's Header/Footer. Any error thrown by an
 * admin loader (e.g. `dashboardLoader` when the API is down) bubbles here.
 */
export function AdminErrorBoundary() {
  const error = useRouteError()

  const is404 = isRouteErrorResponse(error) && error.status === 404
  const title = is404 ? 'Раздел не найден' : 'Не удалось загрузить данные'
  const message = is404
    ? 'Похоже, такой страницы админки нет.'
    : 'Сервер не ответил. Проверьте соединение и попробуйте снова.'

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <span
          aria-hidden="true"
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-2xl text-rose-700"
        >
          !
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-lg font-bold text-rose-700">{title}</h1>
          <p className="text-sm text-neutral-600">{message}</p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center rounded-lg bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-200"
        >
          Повторить
        </button>
      </div>
    </div>
  )
}
