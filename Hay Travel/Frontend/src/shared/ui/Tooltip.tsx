import { useCallback, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useIsCompactViewport, useIsTouchDevice } from '@/shared/hooks'
import { Popover } from './Popover'

export type TooltipCursor = 'inherit' | 'not-allowed' | 'help'

const cursorClass: Record<TooltipCursor, string> = {
  inherit: '',
  'not-allowed': 'cursor-not-allowed',
  help: 'cursor-help',
}

export interface TooltipProps {
  /** Already-localised text (or a small node). Owned by the caller — this component holds no copy. */
  content: ReactNode
  /** The control the tip belongs to. Rendered inside the wrapper span that carries the triggers. */
  children: ReactNode
  /**
   * `false` → children are rendered NAKED: no wrapper span, no listeners, no extra tab stop, and
   * `className` is ignored. That is what makes the conditional case (`<Tooltip enabled={blocked}>`)
   * layout-neutral: when there is nothing to explain, the DOM is byte-identical to not using this
   * component at all, so wrapping a control "just in case" cannot shift it by a pixel.
   * @default true
   */
  enabled?: boolean
  /**
   * Cursor over the wrapper. `not-allowed` is the point of the whole component's main use — the
   * child is `disabled`, so its own `cursor` never applies (see `blockPointer`), and the wrapper is
   * the element the pointer actually sits on.
   * @default 'inherit'
   */
  cursor?: TooltipCursor
  /**
   * `pointer-events: none` on the wrapped element. MUST stay on for a natively `disabled` control:
   * a disabled form control is still the hit target, but the browser suppresses its pointer events
   * AND does not bubble them, so the wrapper would never see the pointer enter. Turn it off only
   * when wrapping something that is still meant to be clickable (a `help` tip on a live control).
   * @default true
   */
  blockPointer?: boolean
  /**
   * Make the wrapper itself focusable. A `disabled` button is removed from the tab order, so
   * without this the tip would be mouse-only — the keyboard user would meet a dead control with no
   * explanation anywhere. Turn it off when the wrapped control can take focus on its own.
   * @default true
   */
  focusable?: boolean
  /** Layout classes for the wrapper — it stands exactly where the child used to stand, so any
   * flex sizing the child carried (e.g. `flex-1 sm:flex-none`) moves here. */
  className?: string
}

/**
 * Text tooltip anchored to a control — built for the "this button is unavailable, here is why"
 * case, but it knows nothing about permissions, auth or any feature: it takes a string and shows it.
 *
 * TRIGGERS, and why they are split by input kind:
 *  - Fine pointer (mouse/trackpad): hover AND keyboard focus. Focus matters as much as hover here —
 *    the typical child is a `disabled` button, which cannot be focused at all, hence `focusable`
 *    putting the WRAPPER in the tab order instead.
 *  - Coarse pointer (phone/tablet) or a compact viewport: TAP toggles it, and it opens as a popup
 *    ANCHORED ON THE CONTROL — deliberately NOT the bottom `Sheet` that `Select`/`HelpButton` fall
 *    back to on the same viewports (spec from Давид, 2026-08-27). A sheet is right for a panel you
 *    interact with; a one-line explanation of the button you just pressed belongs at that button,
 *    or the connection between the two is lost. Hover is suppressed on a coarse pointer because a
 *    tap there also synthesises `mouseover`, which would open and then immediately toggle shut.
 *
 * Both paths reuse `shared/ui/Popover` — same portal, same z-50, same flip-and-clamp placement,
 * same outside-click/Escape dismissal as every other floating panel in the app. No second
 * positioning implementation exists in this codebase and this component does not add one.
 */
export function Tooltip({
  content,
  children,
  enabled = true,
  cursor = 'inherit',
  blockPointer = true,
  focusable = true,
  className = '',
}: TooltipProps) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [hoverOpen, setHoverOpen] = useState(false)
  const [tapOpen, setTapOpen] = useState(false)
  const tooltipId = useId()
  const coarsePointer = useIsTouchDevice()
  const isCompact = useIsCompactViewport()

  const close = useCallback(() => {
    setHoverOpen(false)
    setTapOpen(false)
  }, [])

  // Hooks above the early return on purpose (rules of hooks) — `enabled` may flip at runtime when
  // the permission set refreshes in the background.
  if (!enabled) return <>{children}</>

  const open = hoverOpen || tapOpen
  // Hover/focus belong to a pointer that can hover; tap-to-toggle is offered on touch AND on any
  // compact viewport, so a narrow window on a laptop keeps BOTH affordances rather than losing the
  // tap one at an arbitrary width.
  const hoverTriggers = !coarsePointer
  const tapTriggers = coarsePointer || isCompact

  return (
    <>
      <span
        ref={anchorRef}
        tabIndex={focusable ? 0 : undefined}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={hoverTriggers ? () => setHoverOpen(true) : undefined}
        onMouseLeave={hoverTriggers ? () => setHoverOpen(false) : undefined}
        onFocus={hoverTriggers ? () => setHoverOpen(true) : undefined}
        onBlur={hoverTriggers ? () => setHoverOpen(false) : undefined}
        onClick={tapTriggers ? () => setTapOpen((value) => !value) : undefined}
        className={`inline-flex outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-900 focus-visible:outline-offset-2 ${cursorClass[cursor]} ${blockPointer ? '[&>*]:pointer-events-none' : ''} ${className}`}
      >
        {children}
      </span>

      <Popover
        open={open}
        onClose={close}
        anchorRef={anchorRef}
        className="max-w-[240px] rounded-lg bg-neutral-900 px-2.5 py-1.5 text-xs leading-snug font-medium text-white shadow-[0_6px_20px_rgba(10,10,10,.22)]"
      >
        <div id={tooltipId} role="tooltip">
          {content}
        </div>
      </Popover>
    </>
  )
}
