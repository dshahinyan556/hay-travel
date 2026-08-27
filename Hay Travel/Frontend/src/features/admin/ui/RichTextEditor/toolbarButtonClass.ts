/**
 * One button style, shared by every toggle/trigger in `RichTextToolbar` AND `ColorPicker`'s own
 * trigger (kept in its own module so both can import it without one importing the other).
 *
 * The border stays visible at rest (`border-neutral-300`, not `border-transparent`) — a deliberate
 * departure from the designer's mockup, per Давид's decision 2026-08-22: every toolbar button
 * always shows its outline, not only on hover/active.
 */
export function toolbarButtonClass(active: boolean): string {
  return `flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm font-semibold transition-colors ${
    active
      ? 'border-neutral-900 bg-neutral-900 text-white'
      : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50'
  } disabled:cursor-not-allowed disabled:opacity-50`
}
