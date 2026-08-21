export type OrderStatusBadgeTone = 'neutral' | 'strong' | 'muted'

export interface OrderStatusBadgeProps {
  /** The status text itself (e.g. «Одобрен») — this component has no knowledge of `OrderStatus`,
   * the caller maps its own enum to a label + `tone`. */
  label: string
  /**
   * `neutral` (default) — plain outline, for the common/in-progress statuses.
   * `strong`  — solid black fill, for a status that should read as settled/affirmative
   *             (e.g. Approved/Completed).
   * `muted`   — greyed out further than `neutral`, for a status that should read as
   *             cold/de-emphasised (e.g. Rejected) — WITHOUT reaching for red (checklist §4: this
   *             stays strictly black/white, the "cooler" reading comes from value/weight only).
   */
  tone?: OrderStatusBadgeTone
  className?: string
}

const toneClasses: Record<OrderStatusBadgeTone, string> = {
  neutral: 'border border-neutral-300 bg-white text-neutral-700',
  strong: 'border border-neutral-900 bg-neutral-900 text-white',
  muted: 'border border-neutral-200 bg-neutral-50 text-neutral-400',
}

const dotClasses: Record<OrderStatusBadgeTone, string> = {
  neutral: 'bg-neutral-900',
  strong: 'bg-white',
  // Muted ("cold") statuses get an empty ring instead of a filled dot — same "settled vs.
  // pending" distinction Acumatica draws with colour, done here with fill weight instead.
  muted: 'bg-transparent shadow-[inset_0_0_0_1.5px_theme(colors.neutral.400)]',
}

/**
 * Read-only status pill (checklist `order-toolbar-summary-checklist-2026-08-21.txt` §4) — modelled
 * on Acumatica's "Back Order" pill next to the document header. No `Select`, no chevron, no
 * hover/focus affordance: the order's status changes ONLY through the Approve/Reject action
 * buttons, never by clicking this badge directly, so it renders as a plain `<span>` rather than a
 * `<button>`.
 *
 * Deliberately generic (`label`/`tone`, not `OrderStatus`) — this is a `shared/ui` primitive with
 * no business logic; the order page maps its own `OrderStatus` enum to a label and a tone.
 */
export function OrderStatusBadge({ label, tone = 'neutral', className = '' }: OrderStatusBadgeProps) {
  return (
    <span
      className={`inline-flex h-7 items-center gap-[7px] rounded-full px-3 text-[11px] font-bold tracking-[.08em] whitespace-nowrap uppercase ${toneClasses[tone]} ${className}`}
    >
      <span aria-hidden="true" className={`h-[7px] w-[7px] shrink-0 rounded-full ${dotClasses[tone]}`} />
      {label}
    </span>
  )
}
