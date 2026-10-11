/**
 * React shell around the pure draft engine (`catalogDraft.ts`) — one instance per catalog tab, all
 * six owned by `CatalogPage`, so a tab's draft survives switching to another tab and one Save
 * covers all of them (checklist 4.2).
 *
 * A tab plugs in through a `CatalogTableDef`: how a server row becomes editable values, how values
 * are compared and validated, and which endpoints persist them. The hook knows nothing about any
 * specific catalog; the def knows nothing about React or rendering.
 */

import { useMemo, useState } from 'react'
import { useCopy } from '@/shared/i18n/defineCopy'
import { catalogCopy, type CatalogCopy } from './catalogCopy'
import {
  NEW_ROW_PREFIX,
  addRowTransition,
  applyOutcomeTransition,
  buildSavePlan,
  countChanges,
  deleteRowsTransition,
  deriveRows,
  emptyDraftState,
  hasValidationErrors,
  isOrderDirty,
  reorderTransition,
  restoreRowTransition,
  setFieldTransition,
  setSelectedTransition,
  toBaselineRows,
  toggleSelectedTransition,
  type CatalogDraftState,
  type CatalogEntity,
  type DraftRow,
  type FieldErrors,
  type FieldNormalizers,
  type RowKey,
  type SaveOutcome,
  type SavePlan,
} from './catalogDraft'

/** Already-localised verb phrases for `catalogErrorMessage` («Не удалось {action}: …»). `add`/
 * `delete` exist only for catalogs that can create/delete rows (not Regions). */
export interface CatalogErrorActions {
  save: string
  add?: string
  delete?: string
}

export interface CatalogTableDef<T extends CatalogEntity, V extends object> {
  /** Server row → editable values. */
  toValues: (item: T) => V
  /** Values of a freshly added row. Regions (fixed set) have none — they cannot be added. */
  emptyValues?: () => V
  /** Comparison projections for non-trivial fields (numbers typed as text, image lists…). */
  normalizers?: FieldNormalizers<V>
  /** Same rules as the side-panel forms this table replaced; messages come from `copy`. */
  validate: (values: V, copy: CatalogCopy) => FieldErrors<V>
  update: (item: T, values: V, sortOrder: number) => Promise<unknown>
  /** Must resolve with the created row — its id replaces the client key in a pending drag order. */
  create?: (values: V, sortOrder: number) => Promise<{ id: number }>
  remove?: (id: number) => Promise<void>
  errorActions: (copy: CatalogCopy) => CatalogErrorActions
  /** Wording for API error 2010 when the shared «используется в турах» doesn't fit. */
  inUseMessage?: (copy: CatalogCopy) => string
}

export interface CatalogTableDraft<T extends CatalogEntity, V extends object> {
  def: CatalogTableDef<T, V>
  /** Every row in on-screen order: server rows with edits applied, then/among added rows. */
  rows: DraftRow<T, V>[]
  changeCount: number
  isDirty: boolean
  /** True when some new/changed row breaks a validation rule — Save is refused as a whole. */
  hasErrors: boolean
  selected: ReadonlySet<RowKey>
  setField: <K extends keyof V>(key: RowKey, field: K, value: V[K]) => void
  /** Appends a new row (with `overrides` on top of `def.emptyValues()`); returns its client key. */
  add: (overrides?: Partial<V>) => RowKey
  /** «Удалить» for the given keys — new rows vanish, server rows get «удалится». */
  remove: (keys: readonly RowKey[]) => void
  restore: (key: RowKey) => void
  reorder: (fromIndex: number, toIndex: number) => void
  toggleSelected: (key: RowKey, on: boolean) => void
  setSelected: (keys: readonly RowKey[], on: boolean) => void
  /** «Отмена» — drop the whole draft of this tab. */
  reset: () => void
  plan: () => SavePlan<T, V>
  applyOutcome: (outcome: SaveOutcome) => void
}

export function useCatalogTableDraft<T extends CatalogEntity, V extends object>(
  def: CatalogTableDef<T, V>,
  items: readonly T[],
): CatalogTableDraft<T, V> {
  const copy = useCopy(catalogCopy)
  const [state, setState] = useState<CatalogDraftState<V>>(emptyDraftState<V>)
  const normalizers = useMemo(() => def.normalizers ?? {}, [def])

  // `items` keeps its identity until the loader revalidates, so the baseline (and the image-list
  // client keys `toValues` may mint) is recomputed only when the server data really changed.
  const baseline = useMemo(() => toBaselineRows(items, def.toValues), [items, def])
  const baselineByKey = useMemo(() => new Map(baseline.map((row) => [row.key, row.values])), [baseline])

  const rows = useMemo(
    () => deriveRows(baseline, state, { normalizers, validate: (values) => def.validate(values, copy) }),
    [baseline, state, normalizers, def, copy],
  )
  const orderDirty = isOrderDirty(baseline, state)
  const changeCount = countChanges(rows, baseline, state)
  const selected = useMemo(() => new Set(state.selected), [state.selected])

  return {
    def,
    rows,
    changeCount,
    isDirty: changeCount > 0,
    hasErrors: hasValidationErrors(rows),
    selected,
    setField: (key, field, value) =>
      setState((current) => setFieldTransition(current, key, field, value, baselineByKey.get(key), normalizers)),
    add: (overrides) => {
      if (!def.emptyValues) throw new Error('This catalog has a fixed set of rows — nothing can be added.')
      const key = `${NEW_ROW_PREFIX}${crypto.randomUUID()}`
      const values = { ...def.emptyValues(), ...overrides }
      setState((current) => addRowTransition(current, key, values))
      return key
    },
    remove: (keys) => setState((current) => deleteRowsTransition(current, keys)),
    restore: (key) => setState((current) => restoreRowTransition(current, key)),
    reorder: (fromIndex, toIndex) =>
      setState((current) => reorderTransition(current, baseline, fromIndex, toIndex)),
    toggleSelected: (key, on) => setState((current) => toggleSelectedTransition(current, key, on)),
    setSelected: (keys, on) => setState((current) => setSelectedTransition(current, keys, on)),
    reset: () => setState(emptyDraftState<V>()),
    plan: () => buildSavePlan(rows, orderDirty),
    applyOutcome: (outcome) => setState((current) => applyOutcomeTransition(current, outcome)),
  }
}
