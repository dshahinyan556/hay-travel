import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDownIcon } from './icons'

export interface AccordionProps {
  /** Trigger row content — usually a label, optionally with a badge/count next to it. This is the
   * `<button>`'s own content, so it also supplies the accessible name. */
  trigger: ReactNode
  children: ReactNode
  /** Uncontrolled starting state. Ignored once `expanded` is passed — controlled mode wins. */
  defaultExpanded?: boolean
  /** Controlled state — pair with `onExpandedChange`. Omit both for uncontrolled use. */
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  disabled?: boolean
  /** Used to derive the trigger/panel ids (`aria-controls` link). Auto-generated when omitted. */
  id?: string
  className?: string
  triggerClassName?: string
  contentClassName?: string
}

/**
 * Animated expand/collapse trigger + panel — the first SHARED accordion in the app. Same
 * `aria-expanded` disclosure contract `UserPermissionsCard`'s hand-rolled `useState(expanded)` +
 * `{expanded && <>…</>}` block already used (that block is this component's first intended
 * consumer), but with a real height/opacity transition instead of instant show/hide.
 *
 * The height animation is the CSS grid `0fr → 1fr` row trick, not a measured-`scrollHeight` one:
 * it animates to the panel's true content height — including content that reflows/wraps while
 * open — without a `ResizeObserver`, and it degrades for free: `--dur-base` already collapses to
 * `1ms` under `prefers-reduced-motion` (`index.css`), so nothing extra is needed here for that.
 *
 * Collapsed content is `inert`, not just visually hidden: `grid-rows-[0fr]` + `overflow-hidden`
 * clips it to zero height, but any focusable element inside would otherwise stay reachable by Tab
 * and readable by a screen reader. `inert` removes it from both until the panel reopens.
 */
export function Accordion({
  trigger,
  children,
  defaultExpanded = false,
  expanded,
  onExpandedChange,
  disabled = false,
  id,
  className = '',
  triggerClassName = '',
  contentClassName = '',
}: AccordionProps) {
  const generatedId = useId()
  const baseId = id ?? generatedId
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded)
  const isControlled = expanded !== undefined
  const isExpanded = isControlled ? expanded : internalExpanded

  function toggle() {
    if (disabled) return
    const next = !isExpanded
    if (!isControlled) setInternalExpanded(next)
    onExpandedChange?.(next)
  }

  return (
    <div className={className}>
      <button
        type="button"
        id={`${baseId}-trigger`}
        aria-expanded={isExpanded}
        aria-controls={`${baseId}-panel`}
        disabled={disabled}
        onClick={toggle}
        className={`flex w-full cursor-pointer items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50 ${triggerClassName}`}
      >
        {trigger}
        <ChevronDownIcon
          size={16}
          className={`shrink-0 text-neutral-400 transition-transform duration-[var(--dur-base)] ease-[var(--ease-out-soft)] ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        id={`${baseId}-panel`}
        inert={isExpanded ? undefined : true}
        className={`grid transition-[grid-template-rows] duration-[var(--dur-base)] ease-[var(--ease-out-soft)] ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <div className={contentClassName}>{children}</div>
        </div>
      </div>
    </div>
  )
}
