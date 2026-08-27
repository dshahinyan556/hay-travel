import { useState } from 'react'
import { redirect, useLoaderData, useRevalidator } from 'react-router'
import { MaintenanceFormLayout, Tabs, type TabItem } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import {
  AdminScreen,
  CATALOG_SCREEN_KEYS,
  canView,
  canViewAny,
  ensurePermissionsReady,
  useScreenPermission,
} from '@/shared/auth'
import {
  getExpenseTemplates,
  getPlaces,
  getRegions,
  getTags,
  getTourNoteTemplates,
} from '@/features/admin/api/adminCatalog'
import { PlacesTab } from './places/PlacesTab'
import { ExpenseTemplatesTab } from './expense-templates/ExpenseTemplatesTab'
import { NoteTemplatesTab } from './note-templates/NoteTemplatesTab'
import { RegionsTab } from './regions/RegionsTab'
import { TagsTab } from './tags/TagsTab'
import { catalogCopy } from './lib/catalogCopy'

/**
 * Loads the catalog lists in parallel. Errors are NOT swallowed — a rejection propagates to
 * `AdminErrorBoundary`, same contract as `productsLoader`/`settingsLoader`. Revalidated as a whole
 * after every mutation on any tab (catalogs are small — a handful to a few dozen rows each — so
 * refetching them costs nothing and keeps `tourCount`/cross-tab state honest).
 *
 * ONE route, FIVE independent permission keys. So:
 *  - the route opens when at least one of them is viewable;
 *  - each list is requested only when ITS key is, and stays `null` otherwise — a list nobody may
 *    read must not be fetched just to be thrown away, and `null` is what tells the page to leave
 *    the tab out entirely rather than render an empty one.
 */
export async function catalogLoader() {
  await ensurePermissionsReady()
  if (!canViewAny(CATALOG_SCREEN_KEYS)) throw redirect('/admin')

  const [places, expenseTemplates, noteTemplates, regions, tags] = await Promise.all([
    canView(AdminScreen.CatalogPlaces) ? getPlaces() : Promise.resolve(null),
    canView(AdminScreen.CatalogExpenseTemplates) ? getExpenseTemplates() : Promise.resolve(null),
    canView(AdminScreen.CatalogNoteTemplates) ? getTourNoteTemplates() : Promise.resolve(null),
    canView(AdminScreen.CatalogRegions) ? getRegions() : Promise.resolve(null),
    canView(AdminScreen.CatalogTags) ? getTags() : Promise.resolve(null),
  ])
  return { places, expenseTemplates, noteTemplates, regions, tags }
}

type CatalogTabId = 'places' | 'expenses' | 'notes' | 'regions' | 'tags'

/**
 * Справочники (4.2): reference catalogs consumed as selectable options on the tour form (4.3,
 * not built yet). Four tabs have full CRUD (Places / Expense templates / Note templates / Tags,
 * 2026-08-16) — the backend has Create/Update/Delete for all four (3.4). "Регионы" stays
 * name/slug/order-fixed (seeded by a migration, David 2026-08-01) but its teaser text is
 * editable since 2026-08-02 (`UpdateBlurb`) — see `RegionsTab`.
 *
 * One loader for all five lists; each tab owns its own add/edit/delete state and calls
 * `revalidator.revalidate()` after a successful mutation, same contract as `ProductsPage`.
 *
 * Template B — «Форма обслуживания» (`MaintenanceFormLayout`). All five tabs are the same
 * archetype: independent, unlinked records, edited one at a time in a side panel. «Регионы» is its
 * fixed-set variant — many records, but the count is settled forever by a migration, so Add and
 * Delete are structurally absent rather than merely hidden.
 *
 * The layout's page-level `controlZone` is left empty ON PURPOSE: per the proposal's own §B
 * diagram the tab strip sits ABOVE the control zone, so search/count/«Добавить» belong to the
 * ACTIVE tab, not to the page — each `*Tab` already renders exactly that row (and its own message
 * slot above its own table), and lifting five independent search states up here would only make
 * the page own state it has no use for.
 */
export function CatalogPage() {
  const { places, expenseTemplates, noteTemplates, regions, tags } = useLoaderData<typeof catalogLoader>()
  const copy = useCopy(catalogCopy)
  const revalidator = useRevalidator()

  const placesPermission = useScreenPermission(AdminScreen.CatalogPlaces)
  const expensesPermission = useScreenPermission(AdminScreen.CatalogExpenseTemplates)
  const notesPermission = useScreenPermission(AdminScreen.CatalogNoteTemplates)
  const regionsPermission = useScreenPermission(AdminScreen.CatalogRegions)
  const tagsPermission = useScreenPermission(AdminScreen.CatalogTags)

  const revalidate = () => revalidator.revalidate()

  /** Only the tabs whose list actually loaded. A tab the role cannot read is ABSENT, not empty:
   * an empty «Точки маршрута» would read as "there are none", which is a different statement. */
  const tabs: TabItem[] = [
    places !== null && { id: 'places', label: copy.common.tabs.places },
    expenseTemplates !== null && { id: 'expenses', label: copy.common.tabs.expenses },
    noteTemplates !== null && { id: 'notes', label: copy.common.tabs.notes },
    regions !== null && { id: 'regions', label: copy.common.tabs.regions },
    tags !== null && { id: 'tags', label: copy.common.tabs.tags },
  ].filter((tab): tab is TabItem => tab !== false)

  // Seeded from the first AVAILABLE tab, not the constant `'places'`: the loader guarantees at
  // least one, but it is not necessarily that one.
  const [activeTab, setActiveTab] = useState<CatalogTabId>(() => tabs[0].id as CatalogTabId)

  return (
    <MaintenanceFormLayout title={copy.common.title} subtitle={copy.common.subtitle}>
      {/* Pinned below the mobile hamburger bar (60px) on phones, flush to the viewport top on
          desktop where that bar doesn't exist. Bleeds to `main`'s own edges (`-mx-4 sm:-mx-6`)
          so the background covers content scrolling underneath it. */}
      <div className="sticky top-[60px] z-10 -mx-4 bg-neutral-50 px-4 pt-1 sm:-mx-6 sm:px-6 md:top-0">
        <Tabs
          tabs={tabs}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as CatalogTabId)}
          label={copy.common.tabsLabel}
        />
      </div>

      {activeTab === 'places' && places !== null && (
        <PlacesTab
          places={places}
          // A role may edit points without reading regions: the picker then has no options, and
          // the form says so instead of pretending the list is empty.
          regions={regions}
          permission={placesPermission}
          onMutated={revalidate}
        />
      )}
      {activeTab === 'expenses' && expenseTemplates !== null && (
        <ExpenseTemplatesTab
          items={expenseTemplates}
          permission={expensesPermission}
          onMutated={revalidate}
        />
      )}
      {activeTab === 'notes' && noteTemplates !== null && (
        <NoteTemplatesTab items={noteTemplates} permission={notesPermission} onMutated={revalidate} />
      )}
      {activeTab === 'regions' && regions !== null && (
        <RegionsTab
          regions={regions}
          canUpdate={regionsPermission.canUpdate}
          onMutated={revalidate}
        />
      )}
      {activeTab === 'tags' && tags !== null && (
        <TagsTab items={tags} permission={tagsPermission} onMutated={revalidate} />
      )}
    </MaintenanceFormLayout>
  )
}
