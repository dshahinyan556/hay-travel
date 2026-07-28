import { useMemo } from 'react'
import { Link, useLoaderData } from 'react-router'
import type { LoaderFunctionArgs } from 'react-router'
import { TourType, tourTypeLabels } from '@/features/admin/lib/enums'
import { initTour } from '@/features/admin/api/adminTours'
import { createModelToForm } from '@/features/admin/lib/tourMapper'
import type { TourCreateModel } from '@/shared/types/attours'
import { useTourForm } from './hooks/useTourForm'
import { TourForm } from './components/TourForm'

/**
 * Reads `?type=` from the URL (defaulting to Tour) and fetches the empty create skeleton for
 * that type. Errors propagate to `AdminErrorBoundary` — the loader does not swallow them.
 */
export async function tourCreateLoader({ request }: LoaderFunctionArgs) {
  const typeParam = Number(new URL(request.url).searchParams.get('type'))
  const type: TourType = typeParam === TourType.Excursion ? TourType.Excursion : TourType.Tour
  const dto = await initTour(type)
  return { dto }
}

export function TourCreatePage() {
  const { dto } = useLoaderData<typeof tourCreateLoader>()
  // Keyed by type so switching the URL `?type=` (e.g. from the sidebar) remounts the editor
  // with a fresh initial state instead of keeping the previous type's form.
  return <TourCreateView key={dto.type} dto={dto} />
}

function TourCreateView({ dto }: { dto: TourCreateModel }) {
  const initialState = useMemo(() => createModelToForm(dto), [dto])
  const { state, actions, validation, hasAttemptedSubmit, submit, isSubmitting, error } =
    useTourForm(initialState)

  const title = state.type === TourType.Excursion ? 'Создать экскурсию' : 'Создать тур'

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <nav className="text-xs text-neutral-500" aria-label="Хлебные крошки">
          <Link to="/admin/products" className="transition-colors hover:text-neutral-800">
            Продукты
          </Link>
          <span aria-hidden="true"> · </span>
          <span className="font-semibold text-neutral-800">{tourTypeLabels[state.type]}</span>
        </nav>
        <h1 className="text-xl font-bold text-neutral-900">{title}</h1>
      </header>

      <TourForm
        state={state}
        actions={actions}
        validation={validation}
        hasAttemptedSubmit={hasAttemptedSubmit}
        isSubmitting={isSubmitting}
        submitError={error}
        onSubmit={submit}
      />
    </div>
  )
}
