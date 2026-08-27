import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Spinner } from './Spinner'

export type AdminActionButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive'
export type AdminActionButtonSize = 'sm' | 'md'

/**
 * Strictly black/white palette — this is the "Acumatica-style" admin surface (order toolbar +
 * contextual actions, checklist `order-toolbar-summary-checklist-2026-08-21.txt` §1/§5), a
 * deliberately different visual family from `shared/ui/Button`'s teal `brand-*` palette used
 * elsewhere in `/admin`. No red/green semantic colour anywhere here, even for `destructive`
 * (Delete) — see that file's §1: "инверсия в чёрный на hover, БЕЗ красного акцента". `primary`
 * is a static black fill (`button.txt`'s "чёрный фон/белый текст" contract) with NO shimmer/
 * gradient animation — the only motion anywhere in this set is a 1px press-down on `:active`,
 * matching the approved mockup's "единственное движение — translate-y-px на нажатии".
 *
 * Exact tokens below are lifted from the approved mockup's "Точные значения" hand-off table
 * (section G) — do not re-derive these from scratch, that table is the source of truth.
 */
const variantClasses: Record<AdminActionButtonVariant, string> = {
  // Save — the one filled button on screen, so it reads as the primary action at a glance.
  primary:
    'border border-transparent bg-neutral-950 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.14),0_1px_2px_rgba(10,10,10,.28)] hover:bg-neutral-800 hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,.18),0_2px_6px_rgba(10,10,10,.24)] active:translate-y-px active:bg-neutral-950 active:shadow-none',
  // Add — outlined, neutral-300 border at rest (lighter than Delete's neutral-400, so the two
  // don't read as the same weight of action).
  secondary:
    'border border-neutral-300 bg-white text-neutral-900 shadow-[0_1px_1px_rgba(10,10,10,.04)] hover:border-neutral-400 hover:bg-neutral-50 active:translate-y-px active:bg-neutral-100 active:shadow-none',
  // Cancel — no fill at rest, the lightest-weight action in the row, but still a visible
  // neutral-200 outline at every width: without it, the mobile `collapseOnMobile` icon-only form
  // (no label to anchor it) reads as a floating glyph with no tappable shape, worse still once
  // `disabled` dims it further. neutral-200 stays a full step lighter than `secondary`'s
  // neutral-300, so Cancel is still visually the lightest action, just never shapeless.
  ghost:
    'border border-neutral-200 bg-transparent text-neutral-600 hover:border-neutral-300 hover:bg-neutral-100 hover:text-neutral-900 active:translate-y-px active:bg-neutral-200',
  // Delete — outlined with a darker rest-state border than `secondary`, FULL invert to solid
  // black on hover: in a strict b/w palette this is the strongest "careful" signal available
  // without reaching for red (still backed by the delete-confirmation modal, colour is never the
  // only safeguard).
  destructive:
    'border border-neutral-400 bg-white text-neutral-700 hover:border-neutral-900 hover:bg-neutral-900 hover:text-white active:translate-y-px active:border-neutral-950 active:bg-neutral-950 active:text-white',
}

const sizeClasses: Record<AdminActionButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-2.5 text-xs',
  // 44px on mobile (finger target), 36px from `sm:` up — exact hand-off table values.
  md: 'h-11 gap-[7px] px-4 text-[13px] sm:h-9',
}

export interface AdminActionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Visible + accessible label (also the button's accessible name — always keep it, even for an
   * icon-forward toolbar button; this is an admin tool, not a public icon-only affordance). */
  label: string
  /** Leading glyph — pass one of `shared/ui/icons` (`size={17}` reads well at `size="md"`). */
  icon?: ReactNode
  variant?: AdminActionButtonVariant
  size?: AdminActionButtonSize
  /** Async action in flight. Swaps `icon` for a spinner, forces `disabled`, sets `aria-busy`. */
  pending?: boolean
  /** Label shown while `pending` (e.g. "Одобряем…"). Falls back to `label` so callers that don't
   * need a distinct pending copy don't have to pass anything extra. */
  pendingLabel?: string
  /** Collapse to a 44×44 icon-only button below `sm` (label becomes `sr-only`, kept for a11y) —
   * the mockup's mobile toolbar keeps a visible label ONLY on Save; every other toolbar button
   * (Cancel/Add/Delete/"…") shrinks to an icon. Off by default for callers outside the toolbar
   * (e.g. a standalone contextual action button, which keeps its label at every width). */
  collapseOnMobile?: boolean
}

/**
 * The building block behind `AdminToolbar`'s four buttons AND the contextual action row next to
 * it (Одобрить/Отклонить/Назначить/Отправить клиенту/Отправить исполнителям — checklist §5).
 * Exported on its own so a caller can drop 1-2 of these next to `AdminToolbar` without redoing
 * the visual language; this component carries no business copy or API wiring, only variant/size/
 * icon/pending — the calling page supplies the label, icon and click handler.
 */
export function AdminActionButton({
  label,
  icon,
  variant = 'secondary',
  size = 'md',
  pending = false,
  pendingLabel,
  collapseOnMobile = false,
  disabled,
  className = '',
  type = 'button',
  ...rest
}: AdminActionButtonProps) {
  const isDisabled = disabled || pending
  const shownLabel = pending && pendingLabel ? pendingLabel : label

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={pending || undefined}
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full font-semibold whitespace-nowrap transition-colors duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-900 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-[.42] ${variantClasses[variant]} ${sizeClasses[size]} ${collapseOnMobile ? 'w-11 px-0 sm:w-auto sm:px-4' : ''} ${className}`}
      {...rest}
    >
      {pending ? <Spinner size="sm" /> : icon}
      <span className={collapseOnMobile ? 'sr-only sm:not-sr-only' : undefined}>{shownLabel}</span>
    </button>
  )
}
