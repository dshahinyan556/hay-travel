/**
 * Client-side search for the catalog tabs (replaces `useCatalogSearch`, whose query now lives in
 * the page toolbar). Catalogs are small — a handful to a few dozen rows — so filtering what is
 * already loaded is enough.
 *
 * New rows are never filtered out: «Добавить» must visibly add a row even while a query is typed,
 * and an empty new row matches no query.
 */

import type { CatalogEntity, DraftRow } from './catalogDraft'

export function filterDraftRows<T extends CatalogEntity, V extends object>(
  rows: DraftRow<T, V>[],
  query: string,
  getSearchText: (row: DraftRow<T, V>) => string,
): DraftRow<T, V>[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return rows
  return rows.filter((row) => row.status === 'new' || getSearchText(row).toLowerCase().includes(needle))
}
