import type { ReactNode } from 'react'
import { AdminActionButton } from './AdminActionButton'
import { CloseIcon, PlusIcon, SaveIcon, TrashIcon } from './icons'

export interface AdminToolbarActionState {
  disabled?: boolean
  pending?: boolean
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
  /** Overrides for the default Russian labels, keyed by action. */
  labels?: Partial<Record<'cancel' | 'save' | 'add' | 'delete', string>>
  /** The "…" `AdminActionsMenu` trigger — rendered inside this SAME bordered toolbar card, right
   * after Delete, so it reads as one control zone (matches the mockup: the "…" trigger lives
   * inside `.adm-toolbar`, not as a separate floating button next to it). Optional — a page with
   * nothing left for the grouped menu (checklist §6) can omit it entirely. */
  actionsMenu?: ReactNode
  className?: string
}

const DEFAULT_LABELS = { cancel: 'Отмена', save: 'Сохранить', add: 'Добавить', delete: 'Удалить' } as const

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
  const text = { ...DEFAULT_LABELS, ...labels }

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 rounded-xl border border-neutral-200 bg-white p-2 sm:gap-2 ${className}`}
    >
      <AdminActionButton
        label={text.cancel}
        icon={<CloseIcon size={17} />}
        onClick={onCancel}
        disabled={cancelState.disabled}
        pending={cancelState.pending}
        variant="ghost"
        collapseOnMobile
      />
      <AdminActionButton
        label={text.save}
        icon={<SaveIcon size={17} />}
        onClick={onSave}
        disabled={saveState.disabled}
        pending={saveState.pending}
        variant="primary"
        className="flex-1 sm:flex-none"
      />
      <AdminActionButton
        label={text.add}
        icon={<PlusIcon size={17} />}
        onClick={onAdd}
        disabled={addState.disabled}
        pending={addState.pending}
        collapseOnMobile
      />
      {/* Divider before Delete — sets the destructive action apart so it's never a stray misclick
          next to Add. Hidden on mobile (hand-off table: "мобильный: убирается"). */}
      <span aria-hidden="true" className="mx-1 hidden h-[22px] w-px shrink-0 bg-neutral-200 sm:block" />
      <AdminActionButton
        label={text.delete}
        icon={<TrashIcon size={17} />}
        onClick={onDelete}
        disabled={deleteState.disabled}
        pending={deleteState.pending}
        variant="destructive"
        collapseOnMobile
      />
      {actionsMenu}
    </div>
  )
}
