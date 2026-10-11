/**
 * Pure core of the «Справочники» table draft (checklist 4.1/4.5, 2026-10-11) — ONE engine for all
 * six tabs. No React, no copy, no API: just "server rows + what the admin changed → what the screen
 * shows and what Save must send". `useCatalogTableDraft` wraps it in state, `catalogSave` executes
 * the plan, the grid only renders `DraftRow`s.
 *
 * Draft shape — only DIFFERENCES are stored, never a copy of the list:
 *  - `edits`   — per existing row, the fields the admin touched (`Partial<V>`);
 *  - `added`   — brand-new rows under a client key (`new-…`), not on the server yet;
 *  - `deleted` — existing rows marked «удалится» (their edits are kept, so «Вернуть» restores them);
 *  - `order`   — full key order after a drag, or `null` while the order is the server's own.
 *
 * DIRTY RULE (sync file, общие правила): a change counts only if the value differs from the saved
 * one. Everything visible is DERIVED by comparing against the baseline — a patch that was typed and
 * then erased, a re-picked select value, a double-toggled checkbox, a row dragged back to its place
 * all derive to "no change" on their own. `setField` additionally prunes such patches so the stored
 * draft never grows stale keys, but correctness does not depend on that pruning.
 */

import { arrayMove } from '@dnd-kit/sortable'

/** Row identity inside the draft: `String(id)` for server rows, `new-<uuid>` for added ones. */
export type RowKey = string

/** Minimum shape every catalog entity shares. */
export interface CatalogEntity {
  id: number
  sortOrder: number
}

export type FieldErrors<V> = Partial<Record<keyof V, string>>

/** Per-field comparison projection. A field without one is compared trimmed (strings) or as-is. */
export type FieldNormalizers<V> = { [K in keyof V]?: (value: V[K]) => unknown }

export type RowStatus = 'clean' | 'changed' | 'new' | 'deleted'

export interface CatalogDraftState<V> {
  edits: Readonly<Record<RowKey, Partial<V>>>
  added: readonly { key: RowKey; values: V }[]
  deleted: readonly RowKey[]
  order: readonly RowKey[] | null
  selected: readonly RowKey[]
  /** Server-side failures from the last Save, by row — cleared when that row is edited again. */
  rowErrors: Readonly<Record<RowKey, string>>
}

export function emptyDraftState<V>(): CatalogDraftState<V> {
  return { edits: {}, added: [], deleted: [], order: null, selected: [], rowErrors: {} }
}

/** One server row in baseline order, with its editable projection. */
export interface BaselineRow<T, V> {
  key: RowKey
  item: T
  values: V
}

/** What the table renders — one per row, in on-screen order. */
export interface DraftRow<T, V> {
  key: RowKey
  /** `null` for a row that exists only in the draft. */
  item: T | null
  /** Effective values: baseline with the admin's edits on top. */
  values: V
  status: RowStatus
  /** Fields whose effective value differs from the saved one (always empty for new rows). */
  changed: ReadonlySet<keyof V>
  /** Validation result for new/changed rows; empty for clean and deleted rows. */
  errors: FieldErrors<V>
  /** Error of the last Save attempt for this row, if it failed. */
  serverError: string | null
}

export const NEW_ROW_PREFIX = 'new-'
export const isNewRowKey = (key: RowKey): boolean => key.startsWith(NEW_ROW_PREFIX)
export const rowKeyOf = (entity: CatalogEntity): RowKey => String(entity.id)

/** Baseline rows sorted by `sortOrder` (ties by id, so legacy rows that all share `0` stay stable). */
export function toBaselineRows<T extends CatalogEntity, V>(
  items: readonly T[],
  toValues: (item: T) => V,
): BaselineRow<T, V>[] {
  return [...items]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    .map((item) => ({ key: rowKeyOf(item), item, values: toValues(item) }))
}

function normalizeField<V, K extends keyof V>(normalizers: FieldNormalizers<V>, field: K, value: V[K]): string {
  const normalize = normalizers[field]
  const projected = normalize ? normalize(value) : typeof value === 'string' ? value.trim() : value
  return JSON.stringify(projected ?? null)
}

export function fieldEquals<V, K extends keyof V>(
  normalizers: FieldNormalizers<V>,
  field: K,
  a: V[K],
  b: V[K],
): boolean {
  return normalizeField(normalizers, field, a) === normalizeField(normalizers, field, b)
}

/** Fields of `patch` that really differ from `baseline`. */
export function changedFields<V extends object>(
  normalizers: FieldNormalizers<V>,
  baseline: V,
  patch: Partial<V> | undefined,
): Set<keyof V> {
  const changed = new Set<keyof V>()
  if (!patch) return changed
  for (const field of Object.keys(patch) as (keyof V)[]) {
    if (!fieldEquals(normalizers, field, baseline[field], patch[field] as V[typeof field])) changed.add(field)
  }
  return changed
}

/** Baseline keys followed by added keys — the order the screen shows when nothing was dragged. */
export function defaultOrder<V>(baseline: readonly { key: RowKey }[], state: CatalogDraftState<V>): RowKey[] {
  return [...baseline.map((row) => row.key), ...state.added.map((row) => row.key)]
}

/**
 * The stored drag order reconciled with what exists NOW: keys of rows that are gone (deleted on the
 * server, discarded new rows) are dropped, rows the stored order doesn't know yet (fresh from a
 * revalidation, just added) are appended in their default position.
 */
export function effectiveOrder<V>(baseline: readonly { key: RowKey }[], state: CatalogDraftState<V>): RowKey[] {
  const fallback = defaultOrder(baseline, state)
  if (state.order === null) return fallback
  const existing = new Set(fallback)
  const ordered = state.order.filter((key) => existing.has(key))
  const placed = new Set(ordered)
  return [...ordered, ...fallback.filter((key) => !placed.has(key))]
}

const sameKeys = (a: readonly RowKey[], b: readonly RowKey[]) =>
  a.length === b.length && a.every((key, index) => key === b[index])

export function isOrderDirty<V>(baseline: readonly { key: RowKey }[], state: CatalogDraftState<V>): boolean {
  return state.order !== null && !sameKeys(effectiveOrder(baseline, state), defaultOrder(baseline, state))
}

export interface DeriveOptions<V> {
  normalizers: FieldNormalizers<V>
  validate: (values: V) => FieldErrors<V>
}

/** Everything the screen needs, derived from baseline + draft. */
export function deriveRows<T, V extends object>(
  baseline: readonly BaselineRow<T, V>[],
  state: CatalogDraftState<V>,
  { normalizers, validate }: DeriveOptions<V>,
): DraftRow<T, V>[] {
  const deleted = new Set(state.deleted)
  const byKey = new Map<RowKey, DraftRow<T, V>>()

  for (const row of baseline) {
    const patch = state.edits[row.key]
    const changed = changedFields(normalizers, row.values, patch)
    const values = patch ? { ...row.values, ...patch } : row.values
    const status: RowStatus = deleted.has(row.key) ? 'deleted' : changed.size > 0 ? 'changed' : 'clean'
    byKey.set(row.key, {
      key: row.key,
      item: row.item,
      values,
      status,
      changed: status === 'deleted' ? new Set() : changed,
      errors: status === 'changed' ? validate(values) : {},
      serverError: state.rowErrors[row.key] ?? null,
    })
  }
  for (const row of state.added) {
    byKey.set(row.key, {
      key: row.key,
      item: null,
      values: row.values,
      status: 'new',
      changed: new Set(),
      errors: validate(row.values),
      serverError: state.rowErrors[row.key] ?? null,
    })
  }

  return effectiveOrder(baseline, state)
    .map((key) => byKey.get(key))
    .filter((row): row is DraftRow<T, V> => row !== undefined)
}

/** "N изменений": one per changed / new / deleted row, plus one for a changed order. */
export function countChanges<T, V>(
  rows: readonly DraftRow<T, V>[],
  baseline: readonly { key: RowKey }[],
  state: CatalogDraftState<V>,
): number {
  const rowChanges = rows.filter((row) => row.status !== 'clean').length
  return rowChanges + (isOrderDirty(baseline, state) ? 1 : 0)
}

export const hasValidationErrors = <T, V>(rows: readonly DraftRow<T, V>[]): boolean =>
  rows.some((row) => Object.keys(row.errors).length > 0)

/* -------------------------------------------------------------------------- */
/*  Transitions                                                                */
/* -------------------------------------------------------------------------- */

const withoutKey = <R>(record: Readonly<Record<RowKey, R>>, key: RowKey): Record<RowKey, R> => {
  if (!(key in record)) return record as Record<RowKey, R>
  const next = { ...record }
  delete next[key]
  return next
}

/**
 * Set one field. For an existing row the patch is compared with the baseline right away and a
 * field equal to the saved value is DROPPED from the patch (and an empty patch from `edits`) —
 * see the dirty rule in the header.
 */
export function setFieldTransition<V extends object, K extends keyof V>(
  state: CatalogDraftState<V>,
  key: RowKey,
  field: K,
  value: V[K],
  baselineValues: V | undefined,
  normalizers: FieldNormalizers<V>,
): CatalogDraftState<V> {
  const rowErrors = withoutKey(state.rowErrors, key)
  if (isNewRowKey(key)) {
    return {
      ...state,
      rowErrors,
      added: state.added.map((row) => (row.key === key ? { ...row, values: { ...row.values, [field]: value } } : row)),
    }
  }
  if (baselineValues === undefined) return state
  const patch: Partial<V> = { ...state.edits[key] }
  if (fieldEquals(normalizers, field, baselineValues[field], value)) delete patch[field]
  else patch[field] = value
  const edits = Object.keys(patch).length === 0 ? withoutKey(state.edits, key) : { ...state.edits, [key]: patch }
  return { ...state, edits, rowErrors }
}

export function addRowTransition<V>(state: CatalogDraftState<V>, key: RowKey, values: V): CatalogDraftState<V> {
  return {
    ...state,
    added: [...state.added, { key, values }],
    order: state.order === null ? null : [...state.order, key],
  }
}

/** «Удалить» on the selection: new rows are simply dropped, server rows are marked «удалится». */
export function deleteRowsTransition<V>(state: CatalogDraftState<V>, keys: readonly RowKey[]): CatalogDraftState<V> {
  const target = new Set(keys)
  const deleted = new Set(state.deleted)
  let rowErrors = state.rowErrors
  for (const key of target) {
    if (isNewRowKey(key)) rowErrors = withoutKey(rowErrors, key)
    else deleted.add(key)
  }
  return {
    ...state,
    added: state.added.filter((row) => !target.has(row.key)),
    deleted: [...deleted],
    order: state.order === null ? null : state.order.filter((key) => !(isNewRowKey(key) && target.has(key))),
    selected: state.selected.filter((key) => !target.has(key)),
    rowErrors,
  }
}

/** «Вернуть» — undo the «удалится» mark; the row's own edits (if any) come back with it. */
export function restoreRowTransition<V>(state: CatalogDraftState<V>, key: RowKey): CatalogDraftState<V> {
  return { ...state, deleted: state.deleted.filter((k) => k !== key), rowErrors: withoutKey(state.rowErrors, key) }
}

/** Move a row in the FULL on-screen order (drag is disabled while a search/filter narrows it). */
export function reorderTransition<V>(
  state: CatalogDraftState<V>,
  baseline: readonly { key: RowKey }[],
  fromIndex: number,
  toIndex: number,
): CatalogDraftState<V> {
  const current = effectiveOrder(baseline, state)
  if (fromIndex === toIndex || current[fromIndex] === undefined || current[toIndex] === undefined) return state
  const moved = arrayMove(current, fromIndex, toIndex)
  return { ...state, order: sameKeys(moved, defaultOrder(baseline, state)) ? null : moved }
}

export function toggleSelectedTransition<V>(state: CatalogDraftState<V>, key: RowKey, on: boolean): CatalogDraftState<V> {
  const selected = state.selected.filter((k) => k !== key)
  return { ...state, selected: on ? [...selected, key] : selected }
}

export function setSelectedTransition<V>(
  state: CatalogDraftState<V>,
  keys: readonly RowKey[],
  on: boolean,
): CatalogDraftState<V> {
  const target = new Set(keys)
  const kept = state.selected.filter((key) => !target.has(key))
  return { ...state, selected: on ? [...kept, ...keys] : kept }
}

/* -------------------------------------------------------------------------- */
/*  Save plan                                                                  */
/* -------------------------------------------------------------------------- */

export interface SavePlan<T, V> {
  /** Deletes go first: a slug freed by a deleted point can be reused by a new one in the same Save. */
  deletes: { key: RowKey; item: T }[]
  updates: { key: RowKey; item: T; values: V; sortOrder: number }[]
  creates: { key: RowKey; values: V; sortOrder: number }[]
}

export const isEmptyPlan = <T, V>(plan: SavePlan<T, V>): boolean =>
  plan.deletes.length + plan.updates.length + plan.creates.length === 0

/**
 * What Save has to send for one tab. Positions:
 *  - order untouched → existing rows keep their `sortOrder`, new rows go after the current maximum
 *    (what `nextSortOrder` used to do for the side-panel form);
 *  - order dragged → the surviving rows are renumbered densely `0..n-1` (same rule the old
 *    `useCatalogReorder` applied), and every existing row whose number moves gets an Update even if
 *    none of its fields changed — there is no bulk-reorder endpoint, only `Update` per row.
 */
export function buildSavePlan<T extends CatalogEntity, V>(
  rows: readonly DraftRow<T, V>[],
  orderDirty: boolean,
): SavePlan<T, V> {
  const plan: SavePlan<T, V> = { deletes: [], updates: [], creates: [] }
  const surviving = rows.filter((row) => row.status !== 'deleted')
  const maxSortOrder = rows.reduce((max, row) => (row.item ? Math.max(max, row.item.sortOrder) : max), -1)
  let nextNew = maxSortOrder + 1

  for (const row of rows) {
    if (row.status === 'deleted' && row.item) plan.deletes.push({ key: row.key, item: row.item })
  }
  surviving.forEach((row, index) => {
    if (row.item === null) {
      plan.creates.push({ key: row.key, values: row.values, sortOrder: orderDirty ? index : nextNew++ })
      return
    }
    const sortOrder = orderDirty ? index : row.item.sortOrder
    if (row.status === 'changed' || sortOrder !== row.item.sortOrder) {
      plan.updates.push({ key: row.key, item: row.item, values: row.values, sortOrder })
    }
  })
  return plan
}

export interface SaveOutcome {
  deleted: RowKey[]
  updated: RowKey[]
  created: { key: RowKey; id: number }[]
  failed: Record<RowKey, string>
}

export const failedCount = (outcome: SaveOutcome): number => Object.keys(outcome.failed).length

/**
 * Fold a Save result back into the draft: what went through leaves the draft (the revalidated
 * baseline now carries it), what failed stays exactly as the admin left it, with the server's
 * message attached to the row. Created rows' client keys are swapped for their new server ids in a
 * still-pending drag order, so a partially failed reorder keeps pointing at the right rows.
 */
export function applyOutcomeTransition<V>(state: CatalogDraftState<V>, outcome: SaveOutcome): CatalogDraftState<V> {
  const updated = new Set(outcome.updated)
  const deleted = new Set(outcome.deleted)
  const created = new Map(outcome.created.map(({ key, id }) => [key, String(id)]))
  const edits: Record<RowKey, Partial<V>> = {}
  for (const [key, patch] of Object.entries(state.edits)) {
    if (!updated.has(key) && !deleted.has(key)) edits[key] = patch
  }
  const allSucceeded = failedCount(outcome) === 0
  return {
    edits,
    added: state.added.filter((row) => !created.has(row.key)),
    deleted: state.deleted.filter((key) => !deleted.has(key)),
    order: allSucceeded || state.order === null ? null : state.order.map((key) => created.get(key) ?? key),
    selected: [],
    rowErrors: outcome.failed,
  }
}
