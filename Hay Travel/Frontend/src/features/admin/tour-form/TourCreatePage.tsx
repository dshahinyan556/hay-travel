import { useMemo } from 'react'
import { useLoaderData, useNavigate } from 'react-router'
import type { LoaderFunctionArgs } from 'react-router'
import { UnsavedChangesModal } from '@/shared/ui'
import { useUnsavedChangesGuard } from '@/shared/hooks'
import { AdminScreen, useScreenPermission } from '@/shared/auth'
import { useCopy } from '@/shared/i18n/defineCopy'
import { getStoredLocale } from '@/shared/lib/locale'
import { TourNoteType, TourType } from '@/features/admin/lib/enums'
import { getAllTours, initTour } from '@/features/admin/api/adminTours'
import {
  getExpenseTemplates,
  getPlaces,
  getRegions,
  getTags,
  getTourNoteTemplates,
  getVehicleClasses,
} from '@/features/admin/api/adminCatalog'
import {
  createModelToForm,
  expenseTemplatesToSuggestions,
  noteTemplatesToSuggestions,
  placesToOptions,
  placesToSuggestions,
  toursToDaySources,
  vehicleClassesToOptions,
} from '@/features/admin/lib/tourMapper'
import type { DaySource, VehicleClassOption } from '@/features/admin/lib/tourMapper'
import type { CatalogSuggestions } from '@/features/admin/types/form'
import type { RegionInfoModel, TagInfoModel, TourCreateModel } from '@/shared/types/attours'
import { useTourForm } from './hooks/useTourForm'
import { tourFormCopy } from './lib/tourFormCopy'
import { TourForm } from './components/TourForm'
import { TourFormScreen } from './components/TourFormScreen'

/**
 * Reads `?type=` from the URL (defaulting to Tour) and fetches the empty create skeleton for
 * that type, plus the reference catalogs used for autocomplete suggestions (route points,
 * organizational details/restrictions, additional expenses), the region picker (4.4), the tag
 * picker, and the day-fill sources (F13, part 2). Errors propagate to `AdminErrorBoundary` — the
 * loader does not swallow them.
 */
export async function tourCreateLoader({ request }: LoaderFunctionArgs) {
  const typeParam = Number(new URL(request.url).searchParams.get('type'))
  const type: TourType =
    typeParam === TourType.Excursion
      ? TourType.Excursion
      : typeParam === TourType.Transfer
        ? TourType.Transfer
        : TourType.Tour
  const [dto, places, expenseTemplates, noteTemplates, regions, tags, allTours, vehicleClasses] =
    await Promise.all([
      initTour(type),
      getPlaces(),
      getExpenseTemplates(),
      getTourNoteTemplates(),
      getRegions(),
      getTags(),
      getAllTours(),
      // Мягко: справочник классов авто нужен только трансферу и живёт за отдельным правом
      // (`catalog.vehicle-classes`). Роль, которая может вести туры, но не видит этот справочник,
      // не должна получать полностью нерабочий экран продукта — таблица цен сама объяснит,
      // что классов нет.
      getVehicleClasses().catch(() => []),
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
  return {
    dto,
    catalogSuggestions,
    regions,
    tags,
    daySources,
    vehicleClasses: vehicleClassesToOptions(vehicleClasses),
  }
}

export function TourCreatePage() {
  const { dto, catalogSuggestions, regions, tags, daySources, vehicleClasses } =
    useLoaderData<typeof tourCreateLoader>()
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
      vehicleClasses={vehicleClasses}
    />
  )
}

function TourCreateView({
  dto,
  catalogSuggestions,
  regions,
  tags,
  daySources,
  vehicleClasses,
}: {
  dto: TourCreateModel
  catalogSuggestions: CatalogSuggestions
  regions: RegionInfoModel[]
  tags: TagInfoModel[]
  daySources: DaySource[]
  vehicleClasses: VehicleClassOption[]
}) {
  const initialState = useMemo(() => createModelToForm(dto), [dto])
  const navigate = useNavigate()
  const copy = useCopy(tourFormCopy)
  // `SetFeatured` (досылается после создания, если отмечено «Показывать в избранном») требует
  // `products.Update` — без него галочка видна, но заблокирована с подсказкой.
  const canFeature = useScreenPermission(AdminScreen.Products).canUpdate
  const { state, actions, validation, hasAttemptedSubmit, submit, isSubmitting, error, isDirty } =
    useTourForm(initialState)
  const guard = useUnsavedChangesGuard(isDirty && !isSubmitting)

  const title =
    state.type === TourType.Excursion
      ? copy.page.createExcursion
      : state.type === TourType.Transfer
        ? copy.page.createTransfer
        : copy.page.createTour

  return (
    /* Шаблон A без действия удаления: архивировать ещё нечего — продукт не создан. */
    <TourFormScreen
      type={state.type}
      title={title}
      subtitle={copy.page.subtitleCreate}
      error={error}
      isValid={validation.isValid}
      hasAttemptedSubmit={hasAttemptedSubmit}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSave={submit}
      /* Уход со страницы, а не сброс полей: несохранённый черновик перехватит
         `useUnsavedChangesGuard` и спросит подтверждение — как и раньше, когда «Отмена» была
         обычной ссылкой на список продуктов. */
      onCancel={() => navigate('/admin/products')}
    >
      <TourForm
        state={state}
        actions={actions}
        validation={validation}
        featureHint={canFeature ? null : copy.header.noPermissionHint}
        catalogSuggestions={catalogSuggestions}
        regions={regions}
        tags={tags}
        daySources={daySources}
        vehicleClasses={vehicleClasses}
        onSubmit={submit}
      />

      <UnsavedChangesModal open={guard.isBlocking} onCancel={guard.cancel} onConfirm={guard.confirm} />
    </TourFormScreen>
  )
}
