import type { MoveDirection } from '@/features/admin/tour-form/reducer/tourFormReducer'

/**
 * Small, shared controls for the form's list repeaters (route points, gallery, expenses,
 * details, restrictions, days). Kept in one place so every repeater has identical affordances
 * and hit areas without copy-pasted markup.
 */

interface ReorderButtonsProps {
  onMove: (direction: MoveDirection) => void
  canMoveUp: boolean
  canMoveDown: boolean
  /** Label prefix for screen readers, e.g. "картинку", "точку". */
  itemNoun: string
}

/** Stacked ▲/▼ buttons for reordering a list item. Disabled at the list edges. */
export function ReorderButtons({ onMove, canMoveUp, canMoveDown, itemNoun }: ReorderButtonsProps) {
  return (
    <span className="flex flex-col text-neutral-400">
      <button
        type="button"
        onClick={() => onMove('up')}
        disabled={!canMoveUp}
        aria-label={`Переместить ${itemNoun} вверх`}
        className="cursor-pointer px-1 text-[10px] leading-none transition-colors hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-30"
      >
        ▲
      </button>
      <button
        type="button"
        onClick={() => onMove('down')}
        disabled={!canMoveDown}
        aria-label={`Переместить ${itemNoun} вниз`}
        className="cursor-pointer px-1 text-[10px] leading-none transition-colors hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-30"
      >
        ▼
      </button>
    </span>
  )
}

interface RemoveButtonProps {
  onClick: () => void
  label: string
  disabled?: boolean
}

/** Square icon button that removes a repeater row. Turns rose on hover to signal deletion. */
export function RemoveButton({ onClick, label, disabled = false }: RemoveButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span aria-hidden="true">✕</span>
    </button>
  )
}

interface AddButtonProps {
  onClick: () => void
  children: React.ReactNode
}

/** Full-width dashed "add row" button used at the bottom of each repeater. */
export function AddButton({ onClick, children }: AddButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-2.5 text-sm font-semibold text-brand-700 transition-colors hover:border-brand-600 hover:bg-brand-50"
    >
      <span aria-hidden="true">＋</span>
      {children}
    </button>
  )
}
