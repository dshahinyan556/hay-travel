import { isRouteErrorResponse, Link, useLocation, useRouteError } from 'react-router'
import { buttonClassName } from '@/shared/ui'
import { SessionExpiredError } from '@/shared/auth'
import { ApiError } from '@/shared/lib/http'

/**
 * `errorElement` for the `/admin` route tree. Modelled on the public
 * `app/layout/RouteErrorBoundary.tsx`, but styled for the admin panel: it renders inside
 * the neutral work area without the public site's Header/Footer. Any error thrown by an
 * admin loader (e.g. `dashboardLoader` when the API is down) bubbles here.
 *
 * An expired session gets its own branch. It arrives here as a thrown `SessionExpiredError` from
 * `authFetch` (the refresh token was revoked or ran out mid-session), and "Сервер не ответил.
 * Повторить" would be both wrong and useless for it — reloading only repeats the 401. The user
 * needs to sign in again, with a link that brings them back to the page they were on.
 */
export function AdminErrorBoundary() {
  const error = useRouteError()
  const location = useLocation()

  if (error instanceof SessionExpiredError) {
    const returnTo = encodeURIComponent(`${location.pathname}${location.search}`)
    return (
      <ErrorPanel
        tone="amber"
        glyph="⏳"
        title="Сессия истекла"
        message="Вы слишком долго не выполняли действий или вход был выполнен на другом устройстве. Войдите снова, чтобы продолжить работу."
      >
        <Link to={`/auth?returnTo=${returnTo}`} className={buttonClassName('primary', 'md')}>
          Войти снова
        </Link>
      </ErrorPanel>
    )
  }

  // Two shapes reach here: a React Router `Response` (thrown by the router itself) and a raw
  // `ApiError` (thrown by a loader's fetch) — both carry a status, neither is the other.
  const status = isRouteErrorResponse(error)
    ? error.status
    : error instanceof ApiError
      ? error.status
      : undefined
  const is404 = status === 404
  // Normally unreachable — the section loaders redirect before a forbidden call is made — but a
  // role revoked mid-session would land here, and "сервер не ответил" would be misleading.
  const isForbidden = status === 403

  const title = is404
    ? 'Раздел не найден'
    : isForbidden
      ? 'Недостаточно прав'
      : 'Не удалось загрузить данные'
  const message = is404
    ? 'Похоже, такой страницы админки нет.'
    : isForbidden
      ? 'У вашей роли нет доступа к этому разделу.'
      : 'Сервер не ответил. Проверьте соединение и попробуйте снова.'

  return (
    <ErrorPanel tone="rose" glyph="!" title={title} message={message}>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex items-center justify-center rounded-lg bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-200"
      >
        Повторить
      </button>
    </ErrorPanel>
  )
}

/** Shared full-screen error frame — same layout, different tone/copy/action. */
function ErrorPanel({
  tone,
  glyph,
  title,
  message,
  children,
}: {
  tone: 'rose' | 'amber'
  glyph: string
  title: string
  message: string
  children: React.ReactNode
}) {
  const badgeClass = tone === 'rose' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
  const titleClass = tone === 'rose' ? 'text-rose-700' : 'text-amber-800'

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <span
          aria-hidden="true"
          className={`flex h-14 w-14 items-center justify-center rounded-2xl text-2xl ${badgeClass}`}
        >
          {glyph}
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className={`text-lg font-bold ${titleClass}`}>{title}</h1>
          <p className="text-sm text-neutral-600">{message}</p>
        </div>
        {children}
      </div>
    </div>
  )
}
