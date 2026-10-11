import { useState } from 'react'
import { redirect, useLoaderData, useRevalidator } from 'react-router'
import { AdminToolbar, DataEntryScreenLayout, Tabs, UnsavedChangesModal, type TabItem } from '@/shared/ui'
import { AlertIcon } from '@/shared/ui/icons'
import { useUnsavedChangesGuard } from '@/shared/hooks'
import { useCopy } from '@/shared/i18n/defineCopy'
import {
  AdminScreen,
  CATALOG_SCREEN_KEYS,
  canView,
  canViewAny,
  ensurePermissionsReady,
  useScreenPermission,
  type ScreenPermission,
} from '@/shared/auth'
import {
  getExpenseTemplates,
  getPlaces,
  getRegions,
  getTags,
  getTourNoteTemplates,
  getVehicleClasses,
} from '@/features/admin/api/adminCatalog'
import { PlacesTab } from './places/PlacesTab'
import { placesTable } from './places/placesTable'
import { ExpenseTemplatesTab } from './expense-templates/ExpenseTemplatesTab'
import { expenseTemplatesTable } from './expense-templates/expenseTemplatesTable'
import { NoteTemplatesTab } from './note-templates/NoteTemplatesTab'
import { noteTemplatesTable, type NoteTypeFilter } from './note-templates/noteTemplatesTable'
import { RegionsTab } from './regions/RegionsTab'
import { regionsTable } from './regions/regionsTable'
import { TagsTab } from './tags/TagsTab'
import { tagsTable } from './tags/tagsTable'
import { VehicleClassesTab } from './vehicle-classes/VehicleClassesTab'
import { vehicleClassesTable } from './vehicle-classes/vehicleClassesTable'
import { CatalogSearchInput } from './CatalogSearchInput'
import { catalogCopy, type CatalogCopy } from './lib/catalogCopy'
import { failedCount, type CatalogEntity, type RowKey, type SaveOutcome } from './lib/catalogDraft'
import { executeSavePlan } from './lib/catalogSave'
import { useCatalogTableDraft, type CatalogTableDraft } from './lib/useCatalogTableDraft'

/**
 * Loads the catalog lists in parallel. Errors are NOT swallowed — a rejection propagates to
 * `AdminErrorBoundary`, same contract as `productsLoader`/`settingsLoader`. Revalidated as a whole
 * after every Save (catalogs are small — a handful to a few dozen rows each — so refetching them
 * costs nothing and keeps `tourCount`/cross-tab state honest).
 *
 * ONE route, SIX independent permission keys. So:
 *  - the route opens when at least one of them is viewable;
 *  - each list is requested only when ITS key is, and stays `null` otherwise — a list nobody may
 *    read must not be fetched just to be thrown away, and `null` is what tells the page to leave
 *    the tab out entirely rather than render an empty one.
 */
export async function catalogLoader() {
  await ensurePermissionsReady()
  if (!canViewAny(CATALOG_SCREEN_KEYS)) throw redirect('/admin')

  const [places, expenseTemplates, noteTemplates, regions, tags, vehicleClasses] = await Promise.all([
    canView(AdminScreen.CatalogPlaces) ? getPlaces() : Promise.resolve(null),
    canView(AdminScreen.CatalogExpenseTemplates) ? getExpenseTemplates() : Promise.resolve(null),
    canView(AdminScreen.CatalogNoteTemplates) ? getTourNoteTemplates() : Promise.resolve(null),
    canView(AdminScreen.CatalogRegions) ? getRegions() : Promise.resolve(null),
    canView(AdminScreen.CatalogTags) ? getTags() : Promise.resolve(null),
    canView(AdminScreen.CatalogVehicleClasses) ? getVehicleClasses() : Promise.resolve(null),
  ])
  return { places, expenseTemplates, noteTemplates, regions, tags, vehicleClasses }
}

type CatalogTabId = 'places' | 'expenses' | 'notes' | 'regions' | 'tags' | 'vehicle-classes'

/** Stable stand-in for a list the role cannot read — keeps that tab's draft hook memo-stable. */
const NO_ROWS: never[] = []

/** The page-level view of one tab's draft — everything here is independent of the row type. */
interface CatalogTabSlot {
  id: CatalogTabId
  label: string
  /** The list loaded (the role may view it); an unavailable tab is left out, not shown empty. */
  available: boolean
  count: number
  permission: ScreenPermission
  draft: Pick<
    CatalogTableDraft<CatalogEntity, object>,
    'changeCount' | 'isDirty' | 'hasErrors' | 'selected' | 'reset' | 'remove' | 'applyOutcome'
  >
  /** Runs this tab's Save plan; never rejects — failures come back per row. */
  save: () => Promise<SaveOutcome>
  /** Absent for Regions — a fixed set: no «Добавить» / «Удалить» at all. */
  add?: () => void
}

function slotOf<T extends CatalogEntity, V extends object>(
  draft: CatalogTableDraft<T, V>,
  rest: Omit<CatalogTabSlot, 'draft' | 'save' | 'count'> & { copy: CatalogCopy },
): CatalogTabSlot {
  const { copy, ...slot } = rest
  return {
    ...slot,
    count: draft.rows.filter((row) => row.item !== null).length,
    draft,
    save: () => executeSavePlan(draft.def, draft.plan(), copy),
  }
}

/**
 * Справочники (4.2) — reference catalogs the tour/transfer forms pick from. Since 2026-10-11
 * (checklist «приведение админки к шаблонам», этап 4) every tab is an EDITABLE TABLE over one
 * page-wide draft, by the order screen's pattern: Template A (`DataEntryScreenLayout`), one pinned
 * `AdminToolbar` (Отмена / Сохранить / Добавить / Удалить), nothing reaches the server until
 * «Сохранить». The side-panel forms are gone.
 *
 *  - The draft spans ALL tabs (six `useCatalogTableDraft`s live here, not in the tabs): switching a
 *    tab keeps its edits, a dot on the tab shows where they are, one Save sends everything.
 *  - Save validates first (any invalid new/changed row → nothing is sent, banner + highlighted
 *    cells), then runs each tab's plan row by row. A row the server rejects stays in the draft
 *    with its error; everything else is applied. The loader is revalidated once at the end.
 *  - «Добавить» / «Удалить» act on the ACTIVE tab; each tab's own permission key decides whether
 *    they (and its cells) are live — no rights → visible but disabled with a hint, like orders.
 *  - Search sits in the control zone and filters the active tab (each tab keeps its own query).
 */
export function CatalogPage() {
  const data = useLoaderData<typeof catalogLoader>()
  const copy = useCopy(catalogCopy)
  const revalidator = useRevalidator()

  const permissions = {
    places: useScreenPermission(AdminScreen.CatalogPlaces),
    expenses: useScreenPermission(AdminScreen.CatalogExpenseTemplates),
    notes: useScreenPermission(AdminScreen.CatalogNoteTemplates),
    regions: useScreenPermission(AdminScreen.CatalogRegions),
    tags: useScreenPermission(AdminScreen.CatalogTags),
    vehicleClasses: useScreenPermission(AdminScreen.CatalogVehicleClasses),
  }

  const placesDraft = useCatalogTableDraft(placesTable, data.places ?? NO_ROWS)
  const expensesDraft = useCatalogTableDraft(expenseTemplatesTable, data.expenseTemplates ?? NO_ROWS)
  const notesDraft = useCatalogTableDraft(noteTemplatesTable, data.noteTemplates ?? NO_ROWS)
  const regionsDraft = useCatalogTableDraft(regionsTable, data.regions ?? NO_ROWS)
  const tagsDraft = useCatalogTableDraft(tagsTable, data.tags ?? NO_ROWS)
  const vehicleClassesDraft = useCatalogTableDraft(vehicleClassesTable, data.vehicleClasses ?? NO_ROWS)

  const [noteTypeFilter, setNoteTypeFilter] = useState<NoteTypeFilter>('all')
  const [queries, setQueries] = useState<Partial<Record<CatalogTabId, string>>>({})
  const [saving, setSaving] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)

  const slots: CatalogTabSlot[] = [
    slotOf(placesDraft, {
      id: 'places',
      label: copy.common.tabs.places,
      available: data.places !== null,
      permission: permissions.places,
      add: () => placesDraft.add(),
      copy,
    }),
    slotOf(expensesDraft, {
      id: 'expenses',
      label: copy.common.tabs.expenses,
      available: data.expenseTemplates !== null,
      permission: permissions.expenses,
      add: () => expensesDraft.add(),
      copy,
    }),
    slotOf(notesDraft, {
      id: 'notes',
      label: copy.common.tabs.notes,
      available: data.noteTemplates !== null,
      permission: permissions.notes,
      // A new note opens already scoped to the type the admin is filtering by.
      add: () => notesDraft.add(noteTypeFilter === 'all' ? undefined : { type: String(noteTypeFilter) }),
      copy,
    }),
    slotOf(regionsDraft, {
      id: 'regions',
      label: copy.common.tabs.regions,
      available: data.regions !== null,
      permission: permissions.regions,
      copy,
    }),
    slotOf(tagsDraft, {
      id: 'tags',
      label: copy.common.tabs.tags,
      available: data.tags !== null,
      permission: permissions.tags,
      add: () => tagsDraft.add(),
      copy,
    }),
    slotOf(vehicleClassesDraft, {
      id: 'vehicle-classes',
      label: copy.common.tabs.vehicleClasses,
      available: data.vehicleClasses !== null,
      permission: permissions.vehicleClasses,
      add: () => vehicleClassesDraft.add(),
      copy,
    }),
  ]
  const availableSlots = slots.filter((slot) => slot.available)

  // Seeded from the first AVAILABLE tab: the loader guarantees at least one, not which.
  const [activeTab, setActiveTab] = useState<CatalogTabId>(() => availableSlots[0].id)
  const active = availableSlots.find((slot) => slot.id === activeTab) ?? availableSlots[0]

  const totalChanges = availableSlots.reduce((sum, slot) => sum + slot.draft.changeCount, 0)
  const dirty = totalChanges > 0
  const guard = useUnsavedChangesGuard(dirty && !saving)

  const query = queries[active.id] ?? ''
  const noPermission = copy.common.noPermission
  const anyWritable = availableSlots.some(
    ({ permission }) => permission.canCreate || permission.canUpdate || permission.canDelete,
  )

  function handleCancel() {
    for (const slot of slots) slot.draft.reset()
    setShowErrors(false)
    setBanner(null)
  }

  async function handleSave() {
    if (saving) return
    const dirtySlots = availableSlots.filter((slot) => slot.draft.isDirty)
    if (dirtySlots.length === 0) return
    setShowErrors(true)

    const invalid = dirtySlots.filter((slot) => slot.draft.hasErrors)
    if (invalid.length > 0) {
      setBanner(copy.common.banners.validation(invalid.map((slot) => slot.label).join(', ')))
      if (!invalid.some((slot) => slot.id === active.id)) setActiveTab(invalid[0].id)
      return
    }

    setSaving(true)
    setBanner(null)
    const outcomes: { slot: CatalogTabSlot; outcome: SaveOutcome }[] = []
    try {
      // Strictly sequential — tab after tab, row after row (see `catalogSave.ts`).
      for (const slot of dirtySlots) outcomes.push({ slot, outcome: await slot.save() })
      await revalidator.revalidate()
    } finally {
      // Folded in only after the fresh baseline has landed, so a saved value never flashes back
      // to the old one between "draft cleared" and "loader refetched".
      for (const { slot, outcome } of outcomes) slot.draft.applyOutcome(outcome)
      setSaving(false)
    }

    const failed = outcomes.filter(({ outcome }) => failedCount(outcome) > 0)
    if (failed.length === 0) {
      setShowErrors(false)
      return
    }
    const failedRows = failed.reduce((sum, { outcome }) => sum + failedCount(outcome), 0)
    setBanner(copy.common.banners.partial(failedRows, failed.map(({ slot }) => slot.label).join(', ')))
  }

  function handleDelete() {
    const keys: RowKey[] = [...active.draft.selected]
    if (keys.length > 0) active.draft.remove(keys)
  }

  const tabs: TabItem[] = availableSlots.map((slot) => ({
    id: slot.id,
    label: slot.label,
    badge: slot.count,
    unsavedDot: slot.draft.isDirty ? copy.common.tabHasChanges : undefined,
  }))

  const tabProps = { query, locked: saving, showErrors }

  return (
    <>
      <DataEntryScreenLayout
        title={copy.common.title}
        subtitle={copy.common.subtitle}
        controlZone={
          <>
            <AdminToolbar
              className="w-full sm:w-auto"
              onCancel={handleCancel}
              onSave={() => void handleSave()}
              onAdd={active.add}
              onDelete={active.add ? handleDelete : undefined}
              // Cancel only drops the local draft — no rights involved, no hint.
              cancelState={{ disabled: saving || !dirty }}
              saveState={{
                disabled: saving || !dirty || !anyWritable,
                pending: saving,
                hint: anyWritable ? null : noPermission,
              }}
              addState={{
                disabled: saving || !active.permission.canCreate,
                hint: active.permission.canCreate ? null : noPermission,
              }}
              deleteState={{
                disabled: saving || !active.permission.canDelete || active.draft.selected.size === 0,
                hint: active.permission.canDelete ? null : noPermission,
              }}
            />
            {dirty && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
                {copy.common.changeCount(totalChanges)}
              </span>
            )}
            <div className="w-full sm:ml-auto sm:w-72">
              <CatalogSearchInput
                value={query}
                onChange={(value) => setQueries((current) => ({ ...current, [active.id]: value }))}
                placeholder={active.id === 'places' ? copy.places.searchPlaceholder : copy.common.searchByName}
              />
            </div>
          </>
        }
        message={
          banner && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            >
              <AlertIcon size={17} className="mt-px shrink-0" />
              <span>{banner}</span>
            </div>
          )
        }
      >
        <Tabs
          tabs={tabs}
          activeId={active.id}
          onChange={(id) => setActiveTab(id as CatalogTabId)}
          label={copy.common.tabsLabel}
        />

        {active.id === 'places' && (
          <PlacesTab draft={placesDraft} permission={permissions.places} regions={data.regions} {...tabProps} />
        )}
        {active.id === 'expenses' && (
          <ExpenseTemplatesTab draft={expensesDraft} permission={permissions.expenses} {...tabProps} />
        )}
        {active.id === 'notes' && (
          <NoteTemplatesTab
            draft={notesDraft}
            permission={permissions.notes}
            typeFilter={noteTypeFilter}
            onTypeFilterChange={setNoteTypeFilter}
            {...tabProps}
          />
        )}
        {active.id === 'regions' && (
          <RegionsTab draft={regionsDraft} permission={permissions.regions} {...tabProps} />
        )}
        {active.id === 'tags' && <TagsTab draft={tagsDraft} permission={permissions.tags} {...tabProps} />}
        {active.id === 'vehicle-classes' && (
          <VehicleClassesTab draft={vehicleClassesDraft} permission={permissions.vehicleClasses} {...tabProps} />
        )}
      </DataEntryScreenLayout>

      <UnsavedChangesModal open={guard.isBlocking} onCancel={guard.cancel} onConfirm={guard.confirm} />
    </>
  )
}
