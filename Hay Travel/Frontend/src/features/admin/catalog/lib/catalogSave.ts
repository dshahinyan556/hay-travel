/**
 * Executes one tab's `SavePlan` against the existing per-row endpoints (checklist 4.3). The backend
 * has no batch endpoint for any catalog, so every row is its own request — run strictly one after
 * another, never in parallel: deletes first (a freed slug can be reused by a create in the same
 * Save), then updates, then creates, and a failure of one row never stops the rest. Each failure is
 * kept by row key with an already-localised message (`catalogErrorMessage`, incl. the «используется»
 * code 2010), so the draft can keep that row and show why.
 */

import type { CatalogCopy } from './catalogCopy'
import type { CatalogEntity, SaveOutcome, SavePlan } from './catalogDraft'
import { catalogErrorMessage } from './catalogErrors'
import type { CatalogTableDef } from './useCatalogTableDraft'

export async function executeSavePlan<T extends CatalogEntity, V extends object>(
  def: CatalogTableDef<T, V>,
  plan: SavePlan<T, V>,
  copy: CatalogCopy,
): Promise<SaveOutcome> {
  const actions = def.errorActions(copy)
  const inUse = def.inUseMessage?.(copy)
  const outcome: SaveOutcome = { deleted: [], updated: [], created: [], failed: {} }
  const fail = (key: string, err: unknown, action: string) => {
    outcome.failed[key] = catalogErrorMessage(copy, err, action, inUse)
  }

  for (const { key, item } of plan.deletes) {
    if (!def.remove) continue
    try {
      await def.remove(item.id)
      outcome.deleted.push(key)
    } catch (err) {
      fail(key, err, actions.delete ?? actions.save)
    }
  }
  for (const { key, item, values, sortOrder } of plan.updates) {
    try {
      await def.update(item, values, sortOrder)
      outcome.updated.push(key)
    } catch (err) {
      fail(key, err, actions.save)
    }
  }
  for (const { key, values, sortOrder } of plan.creates) {
    if (!def.create) continue
    try {
      const created = await def.create(values, sortOrder)
      outcome.created.push({ key, id: created.id })
    } catch (err) {
      fail(key, err, actions.add ?? actions.save)
    }
  }
  return outcome
}
