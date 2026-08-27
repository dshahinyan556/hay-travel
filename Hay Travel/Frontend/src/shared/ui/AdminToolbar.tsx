import type { ReactNode } from 'react'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { AdminActionButton } from './AdminActionButton'
import { Tooltip } from './Tooltip'
import { CloseIcon, PlusIcon, SaveIcon, TrashIcon } from './icons'

export interface AdminToolbarActionState {
  disabled?: boolean
  pending?: boolean
  /**
   * Why this action is unavailable — shown as a `Tooltip` on the (still rendered, still visible)
   * button and switches its cursor to `not-allowed`. Meant for a reason the user cannot fix by
   * waiting, i.e. "нет прав": a transient `pending` needs no explanation and must NOT be passed
   * here, or the tip would flash on every save. Setting it does not disable anything by itself —
   * the caller keeps owning `disabled`, so the two can never disagree about which button is live.
   *
   * `null` is accepted and means the same as omitting it: callers derive these from a
   * "reason-or-null" value (see `orders/lib/orderPermissionHints.ts`) and should not have to
   * launder it through `?? undefined` at four call sites.
   */
  hint?: string | null
}

export interface AdminToolbarProps {
  onCancel: () => void
  onSave: () => void
  onAdd: () => void
  onDelete: () => void
  cancelState?: AdminToolbarActionState
  saveState?: AdminToolbarActionState
  addState?: AdminToolbarActionState
  deleteState?: AdminToolbarActionState
  /** Overrides for the default labels (`ui.toolbar.*`, current locale), keyed by action. */
  labels?: Partial<Record<'cancel' | 'save' | 'add' | 'delete', string>>
  /** The "…" `AdminActionsMenu` trigger — rendered inside this SAME bordered toolbar card, right
   * after Delete, so it reads as one control zone (matches the mockup: the "…" trigger lives
   * inside `.adm-toolbar`, not as a separate floating button next to it). Optional — a page with
   * nothing left for the grouped menu (checklist §6) can omit it entirely. */
  actionsMenu?: ReactNode
  className?: string
}

/**
 * Acumatica-style order toolbar (checklist `order-toolbar-summary-checklist-2026-08-21.txt` §1) —
 * exactly four buttons, in this fixed order: Cancel, Save, Add, Delete. `Save` is the only filled
 * ("primary") button — it is the one action that commits the page's draft to the server. Add is
 * `secondary` (outlined, lighter border), Delete is its own `destructive` variant (outlined,
 * darker rest-state border, full black invert on hover — see `AdminActionButton`'s doc comment,
 * and §1's explicit "Delete… БЕЗ красного акцента"), set off from Add by a 1px divider.
 *
 * Container chrome (white card, `neutral-200` border, `rounded-xl`) and the divider are exact
 * values from the approved mockup's hand-off table — this is the toolbar's own frame, a caller
 * does not wrap it in another card.
 *
 * On mobile every button but Save collapses to a 44×44 icon (`collapseOnMobile`); Save keeps its
 * label and grows to fill the remaining width, per the mockup's mobile frame.
 *
 * Fully controlled, no internal state: each button's `disabled`/`pending` is driven independently
 * by the caller (e.g. `saveState.disabled` while the draft isn't dirty, `deleteState.pending`
 * while the delete-confirmation modal's request is in flight). This component does not know what
 * "dirty"/"pending" mean for the order page — it only renders the state it's given.
 *
 * "Prev/Next" navigation, present in the Acumatica reference, was explicitly cancelled by Давид
 * (checklist §1) — not a subset of this component's scope, not added even as a hidden prop.
 */
export function AdminToolbar({
  onCancel,
  onSave,
  onAdd,
  onDelete,
  cancelState = {},
  saveState = {},
  addState = {},
  deleteState = {},
  labels,
  actionsMenu,
  className = '',
}: AdminToolbarProps) {
  const { t } = useLocale()
  // Defaults come from the shared dictionary (`ui.toolbar.*`) rather than a module constant, so
  // the toolbar follows the interface language; a caller's `labels` still wins over them.
  const text = {
    cancel: labels?.cancel ?? t('ui.toolbar.cancel'),
    save: labels?.save ?? t('ui.toolbar.save'),
    add: labels?.add ?? t('ui.toolbar.add'),
    delete: labels?.delete ?? t('ui.toolbar.delete'),
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 rounded-xl border border-neutral-200 bg-white p-2 sm:gap-2 ${className}`}
    >
      <Tooltip enabled={Boolean(cancelState.hint)} content={cancelState.hint} cursor="not-allowed">
        <AdminActionButton
          label={text.cancel}
          icon={<CloseIcon size={17} />}
          onClick={onCancel}
          disabled={cancelState.disabled}
          pending={cancelState.pending}
          variant="ghost"
          collapseOnMobile
        />
      </Tooltip>
      {/* Save is the one button that stretches on mobile, so when it IS wrapped the growth has to
          move to the wrapper (a `flex-1` child of a shrink-to-fit span grows to nothing) and the
          button fills it instead. Unwrapped, `Tooltip` renders no span at all and the original
          class stays exactly where it was. */}
      <Tooltip
        enabled={Boolean(saveState.hint)}
        content={saveState.hint}
        cursor="not-allowed"
        className="flex-1 sm:flex-none"
      >
        <AdminActionButton
          label={text.save}
          icon={<SaveIcon size={17} />}
          onClick={onSave}
          disabled={saveState.disabled}
          pending={saveState.pending}
          variant="primary"
          className={saveState.hint ? 'w-full sm:w-auto' : 'flex-1 sm:flex-none'}
        />
      </Tooltip>
      <Tooltip enabled={Boolean(addState.hint)} content={addState.hint} cursor="not-allowed">
        <AdminActionButton
          label={text.add}
          icon={<PlusIcon size={17} />}
          onClick={onAdd}
          disabled={addState.disabled}
          pending={addState.pending}
          collapseOnMobile
        />
      </Tooltip>
      {/* Divider before Delete — sets the destructive action apart so it's never a stray misclick
          next to Add. Hidden on mobile (hand-off table: "мобильный: убирается"). */}
      <span aria-hidden="true" className="mx-1 hidden h-[22px] w-px shrink-0 bg-neutral-200 sm:block" />
      <Tooltip enabled={Boolean(deleteState.hint)} content={deleteState.hint} cursor="not-allowed">
        <AdminActionButton
          label={text.delete}
          icon={<TrashIcon size={17} />}
          onClick={onDelete}
          disabled={deleteState.disabled}
          pending={deleteState.pending}
          variant="destructive"
          collapseOnMobile
        />
      </Tooltip>
      {actionsMenu}
    </div>
  )
}
