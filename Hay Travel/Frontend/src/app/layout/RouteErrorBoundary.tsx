import { isRouteErrorResponse, useRouteError } from 'react-router'
import { NotFoundPage } from './NotFoundPage'
import { AlertIcon } from '@/shared/ui/icons'

/**
 * Attached as `errorElement` on the root route in `app/router.tsx`. Note: because it
 * sits on the root route, an error anywhere in the tree replaces Header/Footer too
 * (React Router's default bubbling behavior). Acceptable at this scale — revisit with
 * per-route error boundaries if that ever becomes a UX problem.
 */
export function RouteErrorBoundary() {
  const error = useRouteError()

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundPage />
  }

  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center px-4 py-16 text-center">
      <span className="text-wine">
        <AlertIcon size={32} />
      </span>
      <h1 className="mt-4 font-display text-4xl text-ink">Что-то пошло не так</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">
        Попробуйте обновить страницу или вернуться позже.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-6 rounded-full px-5 py-2.5 text-sm text-gold-ink ring-1 ring-gold-line transition-colors hover:bg-accent-soft"
      >
        Обновить
      </button>
    </div>
  )
}
