import { useMemo } from 'react'
import { Link, useLoaderData } from 'react-router'
import type { LoaderFunctionArgs } from 'react-router'
import { TourType, tourTypeLabels } from '@/features/admin/lib/enums'
import { initUpdate } from '@/features/admin/api/adminTours'
import { infoToForm } from '@/features/admin/lib/tourMapper'
import type { TourInfoModel } from '@/shared/types/attours'
import { useTourForm } from './hooks/useTourForm'
import { TourForm } from './components/TourForm'

/**
 * Loads the full edit model for the tour named by `:id`. A missing/invalid id or a failed
 * fetch propagates to `AdminErrorBoundary` — the loader does not swallow it.
 */
export async function tourEditLoader({ params }: LoaderFunctionArgs) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    throw new Response('Некорректный идентификатор тура', { status: 400 })
  }
  const dto = await initUpdate(id)
  return { dto }
}

export function TourEditPage() {
  const { dto } = useLoaderData<typeof tourEditLoader>()
  // Keyed by id so navigating between two edit URLs remounts the editor with fresh state
  // instead of carrying the previous tour's form over.
  return <TourEditView key={dto.id} dto={dto} />
}

function TourEditView({ dto }: { dto: TourInfoModel }) {
  const initialState = useMemo(() => infoToForm(dto), [dto])
  const { state, actions, validation, hasAttemptedSubmit, submit, isSubmitting, error } =
    useTourForm(initialState, {
      kind: 'edit',
      tourId: dto.id,
      initialIsActive: dto.isActive,
    })

  const typeLabel = tourTypeLabels[state.type]
  const title = state.type === TourType.Excursion ? 'Редактировать экскурсию' : 'Редактировать тур'

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <nav className="text-xs text-neutral-500" aria-label="Хлебные крошки">
          <Link to="/admin/products" className="transition-colors hover:text-neutral-800">
            Продукты
          </Link>
          <span aria-hidden="true"> · </span>
          <span className="font-semibold text-neutral-800">{typeLabel}</span>
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
        typeLocked
        onSubmit={submit}
      />
    </div>
  )
}
