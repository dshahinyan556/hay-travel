import { useMemo, useState } from 'react'
import { useLoaderData, useLocation, useNavigate } from 'react-router'
import type { LoaderFunctionArgs } from 'react-router'
import { UnsavedChangesModal } from '@/shared/ui'
import { useUnsavedChangesGuard } from '@/shared/hooks'
import { AdminScreen, useScreenPermission } from '@/shared/auth'
import { ApiError } from '@/shared/lib/http'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { getStoredLocale } from '@/shared/lib/locale'
import { TourNoteType, TourType } from '@/features/admin/lib/enums'
import { getAllTours, initUpdate, setTourArchived } from '@/features/admin/api/adminTours'
import {
  getExpenseTemplates,
  getPlaces,
  getRegions,
  getTags,
  getTourNoteTemplates,
  getVehicleClasses,
} from '@/features/admin/api/adminCatalog'
import {
  expenseTemplatesToSuggestions,
  infoToForm,
  noteTemplatesToSuggestions,
  placesToOptions,
  placesToSuggestions,
  toursToDaySources,
  vehicleClassesToOptions,
} from '@/features/admin/lib/tourMapper'
import type { DaySource, VehicleClassOption } from '@/features/admin/lib/tourMapper'
import type { CatalogSuggestions } from '@/features/admin/types/form'
import type { RegionInfoModel, TagInfoModel, TourInfoModel } from '@/shared/types/attours'
import { readSaveWarning, useTourForm } from './hooks/useTourForm'
import { tourFormCopy } from './lib/tourFormCopy'
import { tourTitle } from '@/features/admin/ui/TourTableParts'
import { TourForm } from './components/TourForm'
import { TourArchiveModal } from './components/TourArchiveModal'
import { TourFormScreen } from './components/TourFormScreen'

/**
 * Loads the full edit model for the tour named by `:id`, plus the reference catalogs used for
 * autocomplete suggestions, the region picker (4.4), the tag picker, and the day-fill sources
 * (F13, part 2). A missing/invalid id or a failed fetch propagates to `AdminErrorBoundary` — the
 * loader does not swallow it.
 */
export async function tourEditLoader({ params }: LoaderFunctionArgs) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    // Not user-facing text: `AdminErrorBoundary` renders its own copy off the status code and
    // never reads this body, so it stays a plain technical statusText.
    throw new Response('Invalid tour id', { status: 400 })
  }
  const [dto, places, expenseTemplates, noteTemplates, regions, tags, allTours, vehicleClasses] =
    await Promise.all([
      initUpdate(id),
      getPlaces(),
      getExpenseTemplates(),
      getTourNoteTemplates(),
      getRegions(),
      getTags(),
      getAllTours(),
      // Мягко — см. тот же вызов в `tourCreateLoader`: справочник классов авто за отдельным
      // правом, и его отсутствие не должно ломать редактирование обычного тура.
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
  // Excludes the tour being edited — filling one of its own days from itself is meaningless.
  // A loader runs outside React, so the copy is resolved from the stored locale, not `useCopy`.
  const daySources = toursToDaySources(allTours, tourFormCopy(getStoredLocale()).days.label, dto.id)
  return {
    dto,
    catalogSuggestions,
    regions,
    tags,
    daySources,
    vehicleClasses: vehicleClassesToOptions(vehicleClasses),
  }
}

export function TourEditPage() {
  const { dto, catalogSuggestions, regions, tags, daySources, vehicleClasses } =
    useLoaderData<typeof tourEditLoader>()
  // Keyed by id so navigating between two edit URLs remounts the editor with fresh state
  // instead of carrying the previous tour's form over.
  return (
    <TourEditView
      key={dto.id}
      dto={dto}
      catalogSuggestions={catalogSuggestions}
      regions={regions}
      tags={tags}
      daySources={daySources}
      vehicleClasses={vehicleClasses}
    />
  )
}

function TourEditView({
  dto,
  catalogSuggestions,
  regions,
  tags,
  daySources,
  vehicleClasses,
}: {
  dto: TourInfoModel
  catalogSuggestions: CatalogSuggestions
  regions: RegionInfoModel[]
  tags: TagInfoModel[]
  daySources: DaySource[]
  vehicleClasses: VehicleClassOption[]
}) {
  const initialState = useMemo(() => infoToForm(dto), [dto])
  const navigate = useNavigate()
  const { locale } = useLocale()
  const copy = useCopy(tourFormCopy)
  // Архивирование — это `Delete` экрана «Продукты» на бэкенде (мягкое удаление того же продукта),
  // отдельного права у него нет: без `products.Delete` кнопки в тулбаре просто нет.
  const permission = useScreenPermission(AdminScreen.Products)
  const canArchive = permission.canDelete
  const { state, actions, validation, hasAttemptedSubmit, submit, isSubmitting, error, isDirty } =
    useTourForm(initialState, { kind: 'edit', tourId: dto.id })

  // Продукт только что создан, но `SetFeatured` после создания не прошёл (лимит 9 и т.п.) —
  // экран создания передал текст сюда через router state. Показывается до следующего действия.
  const location = useLocation()
  const [carriedWarning, setCarriedWarning] = useState<string | null>(() => readSaveWarning(location.state))

  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archivePending, setArchivePending] = useState(false)
  const [archiveError, setArchiveError] = useState<string | null>(null)

  // `archivePending` снимает охрану ровно так же, как `isSubmitting`: продукт уже в архиве, и
  // диалог «есть несохранённые изменения» на редиректе после успеха был бы тупиком.
  const guard = useUnsavedChangesGuard(isDirty && !isSubmitting && !archivePending)

  const title =
    state.type === TourType.Excursion
      ? copy.page.editExcursion
      : state.type === TourType.Transfer
        ? copy.page.editTransfer
        : copy.page.editTour
  // Название берётся из загруженного продукта, а не из черновика: в архив уходит сохранённая
  // запись, и подтверждение должно называть именно её.
  const productTitle = tourTitle(dto, locale).text

  /** Save from the toolbar or by Enter — a new attempt makes the carried-over warning stale. */
  function save(): void {
    setCarriedWarning(null)
    submit()
  }

  async function confirmArchive(): Promise<void> {
    if (archivePending) return
    setArchivePending(true)
    setArchiveError(null)
    try {
      await setTourArchived(dto.id, true)
      // Без `setArchivePending(false)`: экран заменяется списком продуктов, и кнопка должна
      // остаться в состоянии ожидания до самого перехода.
      navigate('/admin/products')
    } catch (err) {
      setArchiveOpen(false)
      setArchiveError(
        err instanceof ApiError ? copy.archive.errorServer(err.status) : copy.archive.errorNetwork,
      )
      setArchivePending(false)
    }
  }

  return (
    <TourFormScreen
      type={state.type}
      title={title}
      subtitle={copy.page.subtitleEdit}
      /* Ошибка сохранения и ошибка архивации показываются в одном слоте — одновременно они
         возникнуть не могут: обе операции блокируют тулбар целиком. */
      error={error ?? archiveError ?? carriedWarning}
      isValid={validation.isValid}
      hasAttemptedSubmit={hasAttemptedSubmit}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSave={save}
      onCancel={() => navigate('/admin/products')}
      archive={
        canArchive
          ? {
              pending: archivePending,
              onRequest: () => {
                setArchiveError(null)
                setCarriedWarning(null)
                setArchiveOpen(true)
              },
            }
          : undefined
      }
    >
      <TourForm
        state={state}
        actions={actions}
        validation={validation}
        featureHint={permission.canUpdate ? null : copy.header.noPermissionHint}
        typeLocked
        catalogSuggestions={catalogSuggestions}
        regions={regions}
        tags={tags}
        daySources={daySources}
        vehicleClasses={vehicleClasses}
        onSubmit={save}
      />

      <TourArchiveModal
        open={archiveOpen}
        productTitle={productTitle}
        pending={archivePending}
        hasUnsavedChanges={isDirty}
        onCancel={() => setArchiveOpen(false)}
        onConfirm={() => void confirmArchive()}
      />

      <UnsavedChangesModal open={guard.isBlocking} onCancel={guard.cancel} onConfirm={guard.confirm} />
    </TourFormScreen>
  )
}
