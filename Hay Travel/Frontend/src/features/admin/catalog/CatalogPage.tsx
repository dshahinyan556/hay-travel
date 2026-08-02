import { useState } from 'react'
import { useLoaderData, useRevalidator } from 'react-router'
import { Tabs, type TabItem } from '@/shared/ui'
import {
  getExpenseTemplates,
  getPlaces,
  getRegions,
  getTourNoteTemplates,
} from '@/features/admin/api/adminCatalog'
import { PlacesTab } from './places/PlacesTab'
import { ExpenseTemplatesTab } from './expense-templates/ExpenseTemplatesTab'
import { NoteTemplatesTab } from './note-templates/NoteTemplatesTab'
import { RegionsTab } from './regions/RegionsTab'

/** Loads all four catalog lists in parallel. Errors are NOT swallowed — a rejection propagates
 * to `AdminErrorBoundary`, same contract as `productsLoader`/`settingsLoader`. Revalidated as a
 * whole after every mutation on any tab (catalogs are small — a handful to a few dozen rows
 * each — so refetching all four costs nothing and keeps `tourCount`/cross-tab state honest). */
export async function catalogLoader() {
  const [places, expenseTemplates, noteTemplates, regions] = await Promise.all([
    getPlaces(),
    getExpenseTemplates(),
    getTourNoteTemplates(),
    getRegions(),
  ])
  return { places, expenseTemplates, noteTemplates, regions }
}

type CatalogTabId = 'places' | 'expenses' | 'notes' | 'regions'

const tabs: TabItem[] = [
  { id: 'places', label: 'Точки маршрута' },
  { id: 'expenses', label: 'Доп. расходы' },
  { id: 'notes', label: 'Заметки' },
  { id: 'regions', label: 'Регионы' },
]

/**
 * Справочники (4.2): reference catalogs consumed as selectable options on the tour form (4.3,
 * not built yet). Three tabs have full CRUD (Places / Expense templates / Note templates) — the
 * backend has Create/Update/Delete for all three (3.4). "Регионы" stays name/slug/order-fixed
 * (seeded by a migration, David 2026-08-01) but its teaser text is editable since 2026-08-02
 * (`UpdateBlurb`) — see `RegionsTab`.
 *
 * One loader for all four lists; each tab owns its own add/edit/delete state and calls
 * `revalidator.revalidate()` after a successful mutation, same contract as `ProductsPage`.
 */
export function CatalogPage() {
  const { places, expenseTemplates, noteTemplates, regions } = useLoaderData<typeof catalogLoader>()
  const revalidator = useRevalidator()
  const [activeTab, setActiveTab] = useState<CatalogTabId>('places')

  const revalidate = () => revalidator.revalidate()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-neutral-900">Справочники</h1>
        <p className="text-sm text-neutral-500">
          Общие точки маршрута, доп. расходы и заметки, которые можно подставлять в туры.
        </p>
      </header>

      {/* Pinned below the mobile hamburger bar (60px) on phones, flush to the viewport top on
          desktop where that bar doesn't exist. Bleeds to `main`'s own edges (`-mx-4 sm:-mx-6`)
          so the background covers content scrolling underneath it. */}
      <div className="sticky top-[60px] z-10 -mx-4 bg-neutral-50 px-4 pt-1 sm:-mx-6 sm:px-6 md:top-0">
        <Tabs
          tabs={tabs}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as CatalogTabId)}
          label="Разделы справочников"
        />
      </div>

      {activeTab === 'places' && (
        <PlacesTab places={places} regions={regions} onMutated={revalidate} />
      )}
      {activeTab === 'expenses' && (
        <ExpenseTemplatesTab items={expenseTemplates} onMutated={revalidate} />
      )}
      {activeTab === 'notes' && <NoteTemplatesTab items={noteTemplates} onMutated={revalidate} />}
      {activeTab === 'regions' && <RegionsTab regions={regions} onMutated={revalidate} />}
    </div>
  )
}
