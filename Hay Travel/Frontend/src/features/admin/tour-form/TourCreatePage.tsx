import { useMemo } from 'react'
import { Link, useLoaderData } from 'react-router'
import type { LoaderFunctionArgs } from 'react-router'
import { UnsavedChangesModal } from '@/shared/ui'
import { useUnsavedChangesGuard } from '@/shared/hooks'
import { useCopy } from '@/shared/i18n/defineCopy'
import { getStoredLocale } from '@/shared/lib/locale'
import { TourNoteType, TourType } from '@/features/admin/lib/enums'
import { adminEnumsCopy } from '@/features/admin/lib/adminEnumsCopy'
import { getAllTours, initTour } from '@/features/admin/api/adminTours'
import { getExpenseTemplates, getPlaces, getRegions, getTags, getTourNoteTemplates } from '@/features/admin/api/adminCatalog'
import {
  createModelToForm,
  expenseTemplatesToSuggestions,
  noteTemplatesToSuggestions,
  placesToOptions,
  placesToSuggestions,
  toursToDaySources,
} from '@/features/admin/lib/tourMapper'
import type { DaySource } from '@/features/admin/lib/tourMapper'
import type { CatalogSuggestions } from '@/features/admin/types/form'
import type { RegionInfoModel, TagInfoModel, TourCreateModel } from '@/shared/types/attours'
import { useTourForm } from './hooks/useTourForm'
import { tourFormCopy } from './lib/tourFormCopy'
import { TourForm } from './components/TourForm'

/**
 * Reads `?type=` from the URL (defaulting to Tour) and fetches the empty create skeleton for
 * that type, plus the reference catalogs used for autocomplete suggestions (route points,
 * organizational details/restrictions, additional expenses), the region picker (4.4), the tag
 * picker, and the day-fill sources (F13, part 2). Errors propagate to `AdminErrorBoundary` — the
 * loader does not swallow them.
 */
export async function tourCreateLoader({ request }: LoaderFunctionArgs) {
  const typeParam = Number(new URL(request.url).searchParams.get('type'))
  const type: TourType = typeParam === TourType.Excursion ? TourType.Excursion : TourType.Tour
  const [dto, places, expenseTemplates, noteTemplates, regions, tags, allTours] = await Promise.all([
    initTour(type),
    getPlaces(),
    getExpenseTemplates(),
    getTourNoteTemplates(),
    getRegions(),
    getTags(),
    getAllTours(),
  ])
  const catalogSuggestions: CatalogSuggestions = {
    routePoints: placesToSuggestions(places),
    placeOptions: placesToOptions(places),
    orgDetails: noteTemplatesToSuggestions(noteTemplates, TourNoteType.OrganizationalDetail),
    restrictions: noteTemplatesToSuggestions(noteTemplates, TourNoteType.Restriction),
    included: noteTemplatesToSuggestions(noteTemplates, TourNoteType.Included),
    notIncluded: noteTemplatesToSuggestions(noteTemplates, TourNoteType.NotIncluded),
    expenses: expenseTemplatesToSuggestions(expenseTemplates),
  }
  // No tour exists yet to exclude — a fresh create form offers every existing product as a source.
  // A loader runs outside React, so the copy is resolved from the stored locale, not `useCopy`.
  const daySources = toursToDaySources(allTours, tourFormCopy(getStoredLocale()).days.label)
  return { dto, catalogSuggestions, regions, tags, daySources }
}

export function TourCreatePage() {
  const { dto, catalogSuggestions, regions, tags, daySources } = useLoaderData<typeof tourCreateLoader>()
  // Keyed by type so switching the URL `?type=` (e.g. from the sidebar) remounts the editor
  // with a fresh initial state instead of keeping the previous type's form.
  return (
    <TourCreateView
      key={dto.type}
      dto={dto}
      catalogSuggestions={catalogSuggestions}
      regions={regions}
      tags={tags}
      daySources={daySources}
    />
  )
}

function TourCreateView({
  dto,
  catalogSuggestions,
  regions,
  tags,
  daySources,
}: {
  dto: TourCreateModel
  catalogSuggestions: CatalogSuggestions
  regions: RegionInfoModel[]
  tags: TagInfoModel[]
  daySources: DaySource[]
}) {
  const initialState = useMemo(() => createModelToForm(dto), [dto])
  const copy = useCopy(tourFormCopy)
  const typeLabels = useCopy(adminEnumsCopy).tourType
  const { state, actions, validation, hasAttemptedSubmit, submit, isSubmitting, error, isDirty } =
    useTourForm(initialState)
  const guard = useUnsavedChangesGuard(isDirty && !isSubmitting)

  const title = state.type === TourType.Excursion ? copy.page.createExcursion : copy.page.createTour

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <nav className="text-xs text-neutral-500" aria-label={copy.page.breadcrumbs}>
          <Link to="/admin/products" className="transition-colors hover:text-neutral-800">
            {copy.page.products}
          </Link>
          <span aria-hidden="true"> · </span>
          <span className="font-semibold text-neutral-800">{typeLabels[state.type]}</span>
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
        catalogSuggestions={catalogSuggestions}
        regions={regions}
        tags={tags}
        daySources={daySources}
        onSubmit={submit}
      />

      <UnsavedChangesModal open={guard.isBlocking} onCancel={guard.cancel} onConfirm={guard.confirm} />
    </div>
  )
}
