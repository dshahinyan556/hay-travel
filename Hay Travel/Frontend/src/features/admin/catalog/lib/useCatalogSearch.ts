/**
 * Client-side name search for the three CRUD catalog tabs (Places / Expense templates / Note
 * templates). Catalogs are small (a handful to a few dozen rows), so filtering the already-loaded
 * list is enough — no server round trip.
 *
 * Reordering is disabled while a query is active (see the tabs): `useCatalogReorder`'s drag
 * indices address the full row list, and handing it a filtered subset would silently reassign the
 * wrong `sortOrder` to the wrong row.
 */

import { useMemo, useState } from 'react'

export interface CatalogSearch<T> {
  query: string
  setQuery: (value: string) => void
  /** `items` unchanged when `query` is blank; otherwise the subset matching `getSearchText`. */
  filtered: T[]
  /** True while a query narrows the list — callers use this to switch off drag-and-drop. */
  isFiltering: boolean
}

export function useCatalogSearch<T>(items: T[], getSearchText: (item: T) => string): CatalogSearch<T> {
  const [query, setQuery] = useState('')
  const trimmed = query.trim().toLowerCase()

  const filtered = useMemo(() => {
    if (!trimmed) return items
    return items.filter((item) => getSearchText(item).toLowerCase().includes(trimmed))
  }, [items, trimmed, getSearchText])

  return { query, setQuery, filtered, isFiltering: trimmed !== '' }
}
