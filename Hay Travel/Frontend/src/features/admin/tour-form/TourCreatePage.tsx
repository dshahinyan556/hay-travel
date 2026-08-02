import { useMemo } from 'react'
import { Link, useLoaderData } from 'react-router'
import type { LoaderFunctionArgs } from 'react-router'
import { UnsavedChangesModal } from '@/shared/ui'
import { useUnsavedChangesGuard } from '@/shared/hooks'
import { TourNoteType, TourType, tourTypeLabels } from '@/features/admin/lib/enums'
import { initTour } from '@/features/admin/api/adminTours'
import { getExpenseTemplates, getPlaces, getRegions, getTourNoteTemplates } from '@/features/admin/api/adminCatalog'
import {
  createModelToForm,
  expenseTemplatesToSuggestions,
  noteTemplatesToSuggestions,
  placesToSuggestions,
} from '@/features/admin/lib/tourMapper'
import type { CatalogSuggestions } from '@/features/admin/types/form'
import type { RegionInfoModel, TourCreateModel } from '@/shared/types/attours'
import { useTourForm } from './hooks/useTourForm'
import { TourForm } from './components/TourForm'

/**
 * Reads `?type=` from the URL (defaulting to Tour) and fetches the empty create skeleton for
 * that type, plus the reference catalogs used for autocomplete suggestions (route points,
 * organizational details/restrictions, additional expenses) and the region picker (4.4). Errors
 * propagate to `AdminErrorBoundary` — the loader does not swallow them.
 */
export async function tourCreateLoader({ request }: LoaderFunctionArgs) {
  const typeParam = Number(new URL(request.url).searchParams.get('type'))
  const type: TourType = typeParam === TourType.Excursion ? TourType.Excursion : TourType.Tour
  const [dto, places, expenseTemplates, noteTemplates, regions] = await Promise.all([
    initTour(type),
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

export function TourCreatePage() {
  const { dto, catalogSuggestions, regions } = useLoaderData<typeof tourCreateLoader>()
  // Keyed by type so switching the URL `?type=` (e.g. from the sidebar) remounts the editor
  // with a fresh initial state instead of keeping the previous type's form.
  return <TourCreateView key={dto.type} dto={dto} catalogSuggestions={catalogSuggestions} regions={regions} />
}

function TourCreateView({
  dto,
  catalogSuggestions,
  regions,
}: {
  dto: TourCreateModel
  catalogSuggestions: CatalogSuggestions
  regions: RegionInfoModel[]
}) {
  const initialState = useMemo(() => createModelToForm(dto), [dto])
  const { state, actions, validation, hasAttemptedSubmit, submit, isSubmitting, error, isDirty } =
    useTourForm(initialState)
  const guard = useUnsavedChangesGuard(isDirty && !isSubmitting)

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
        isDirty={isDirty}
        catalogSuggestions={catalogSuggestions}
        regions={regions}
        onSubmit={submit}
      />

      <UnsavedChangesModal open={guard.isBlocking} onCancel={guard.cancel} onConfirm={guard.confirm} />
    </div>
  )
}
