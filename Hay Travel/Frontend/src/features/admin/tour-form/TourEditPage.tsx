import { useMemo } from 'react'
import { Link, useLoaderData } from 'react-router'
import type { LoaderFunctionArgs } from 'react-router'
import { UnsavedChangesModal } from '@/shared/ui'
import { useUnsavedChangesGuard } from '@/shared/hooks'
import { TourNoteType, TourType, tourTypeLabels } from '@/features/admin/lib/enums'
import { initUpdate } from '@/features/admin/api/adminTours'
import { getExpenseTemplates, getPlaces, getRegions, getTourNoteTemplates } from '@/features/admin/api/adminCatalog'
import {
  expenseTemplatesToSuggestions,
  infoToForm,
  noteTemplatesToSuggestions,
  placesToSuggestions,
} from '@/features/admin/lib/tourMapper'
import type { CatalogSuggestions } from '@/features/admin/types/form'
import type { RegionInfoModel, TourInfoModel } from '@/shared/types/attours'
import { useTourForm } from './hooks/useTourForm'
import { TourForm } from './components/TourForm'

/**
 * Loads the full edit model for the tour named by `:id`, plus the reference catalogs used for
 * autocomplete suggestions and the region picker (4.4). A missing/invalid id or a failed fetch
 * propagates to `AdminErrorBoundary` — the loader does not swallow it.
 */
export async function tourEditLoader({ params }: LoaderFunctionArgs) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    throw new Response('Некорректный идентификатор тура', { status: 400 })
  }
  const [dto, places, expenseTemplates, noteTemplates, regions] = await Promise.all([
    initUpdate(id),
    getPlaces(),
    getExpenseTemplates(),
    getTourNoteTemplates(),
    getRegions(),
  ])
  const catalogSuggestions: CatalogSuggestions = {
    routePoints: placesToSuggestions(places),
    orgDetails: noteTemplatesToSuggestions(noteTemplates, TourNoteType.OrganizationalDetail),
    restrictions: noteTemplatesToSuggestions(noteTemplates, TourNoteType.Restriction),
    included: noteTemplatesToSuggestions(noteTemplates, TourNoteType.Included),
    notIncluded: noteTemplatesToSuggestions(noteTemplates, TourNoteType.NotIncluded),
    expenses: expenseTemplatesToSuggestions(expenseTemplates),
  }
  return { dto, catalogSuggestions, regions }
}

export function TourEditPage() {
  const { dto, catalogSuggestions, regions } = useLoaderData<typeof tourEditLoader>()
  // Keyed by id so navigating between two edit URLs remounts the editor with fresh state
  // instead of carrying the previous tour's form over.
  return <TourEditView key={dto.id} dto={dto} catalogSuggestions={catalogSuggestions} regions={regions} />
}

function TourEditView({
  dto,
  catalogSuggestions,
  regions,
}: {
  dto: TourInfoModel
  catalogSuggestions: CatalogSuggestions
  regions: RegionInfoModel[]
}) {
  const initialState = useMemo(() => infoToForm(dto), [dto])
  const { state, actions, validation, hasAttemptedSubmit, submit, isSubmitting, error, isDirty } =
    useTourForm(initialState, {
      kind: 'edit',
      tourId: dto.id,
      initialIsActive: dto.isActive,
    })
  const guard = useUnsavedChangesGuard(isDirty && !isSubmitting)

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
        catalogSuggestions={catalogSuggestions}
        regions={regions}
        onSubmit={submit}
      />

      <UnsavedChangesModal open={guard.isBlocking} onCancel={guard.cancel} onConfirm={guard.confirm} />
    </div>
  )
}
