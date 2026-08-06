/**
 * Small, shared controls for admin forms' list repeaters (tour route points, gallery, expenses,
 * details, restrictions, days; catalog Place photos). Kept in one place so every repeater has
 * identical affordances and hit areas without copy-pasted markup. Lives in `features/admin/ui/`
 * (not `tour-form/`) because it is used by both the tour form and the Place catalog form.
 *
 * Reordering is NOT here: it is drag-and-drop via the shared `SortableList`/`DragHandle`
 * primitive (`shared/ui/SortableList.tsx`), which replaced the old ▲/▼ buttons.
 */

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
