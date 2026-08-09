import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const GAP_PX = 6
const VIEWPORT_MARGIN_PX = 8

interface Position {
  top: number
  left: number
  width?: number
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max))

/** Sub-pixel tolerance for "the panel has not moved" — see the call site in `recompute`. */
const POSITION_EPSILON_PX = 0.5

const sameNumber = (a: number | undefined, b: number | undefined) =>
  a === b || (a !== undefined && b !== undefined && Math.abs(a - b) < POSITION_EPSILON_PX)

const samePosition = (a: Position, b: Position) =>
  sameNumber(a.top, b.top) && sameNumber(a.left, b.left) && sameNumber(a.width, b.width)

/**
 * Flip-and-clamp placement, computed from two already-measured rects — pure, so it is testable
 * without a DOM and does not care how the caller obtained the rects.
 *
 * Opens below the anchor by default; flips above when there isn't `panelHeight + GAP_PX` of room
 * below AND there is more room above than below (so a short viewport doesn't flip-flop forever).
 * Horizontally, the panel is left-aligned with the anchor and then clamped into the viewport with
 * an `VIEWPORT_MARGIN_PX` margin — never centred, to keep the maths (and the reasoning about it)
 * to one axis of freedom.
 */
function computePosition(
  anchorRect: DOMRect,
  panelRect: DOMRect,
  matchAnchorWidth: boolean,
  viewportWidth: number,
  viewportHeight: number,
): Position {
  const spaceBelow = viewportHeight - anchorRect.bottom
  const spaceAbove = anchorRect.top
  const openUp = spaceBelow < panelRect.height + GAP_PX && spaceAbove > spaceBelow

  const top = openUp
    ? clamp(
        anchorRect.top - GAP_PX - panelRect.height,
        VIEWPORT_MARGIN_PX,
        viewportHeight - VIEWPORT_MARGIN_PX - panelRect.height,
      )
    : clamp(
        anchorRect.bottom + GAP_PX,
        VIEWPORT_MARGIN_PX,
        viewportHeight - VIEWPORT_MARGIN_PX - panelRect.height,
      )

  // `matchAnchorWidth` is a FLOOR, not a fixed width: the panel is never narrower than the anchor,
  // but a long option label is allowed to make it wider. On the first pass `panelRect` is the
  // content's natural width (no constraint applied yet); on every later pass it is the width we
  // already applied, and `max()` of a value with itself is a fixed point — which is what lets the
  // bail-out below actually fire.
  const width = matchAnchorWidth ? Math.max(anchorRect.width, panelRect.width) : panelRect.width
  const left = clamp(
    anchorRect.left,
    VIEWPORT_MARGIN_PX,
    viewportWidth - VIEWPORT_MARGIN_PX - width,
  )

  return { top, left, width: matchAnchorWidth ? width : undefined }
}

export interface PopoverProps {
  open: boolean
  /** Called on outside click or Escape. Escape also returns focus to `anchorRef.current`. */
  onClose: () => void
  /** The trigger the popover is anchored to and, on Escape, returns focus to. */
  anchorRef: React.RefObject<HTMLElement | null>
  children: React.ReactNode
  /**
   * Make the panel AT LEAST as wide as the anchor (a `Select` trigger) — a floor, not a fixed
   * width: if the anchor is narrower than the panel's own content needs (e.g. the longest option
   * label), the panel is allowed to be wider than the anchor rather than clipping that content.
   * Leave it `false` for a panel with its own intrinsic width regardless of the anchor (a
   * `DatePicker` calendar next to a narrow date field).
   */
  matchAnchorWidth?: boolean
  className?: string
}

/**
 * Desktop anchored popup — portal, flip-and-clamp positioning, outside-click and Escape to
 * dismiss. The compact-viewport counterpart is `Sheet` (bottom sheet); callers pick between the
 * two with `useIsCompactViewport`, this component only handles the "popup at an anchor" case.
 *
 * Deliberately does NOT own focus:
 *  - `Select` uses the ARIA 1.2 combobox pattern — focus stays on the trigger the whole time,
 *    the listbox is navigated via `aria-activedescendant`, so there is nothing to trap.
 *  - `DatePicker` uses the APG "Date Picker Dialog" pattern instead — focus moves into the
 *    calendar grid, so it wires its own `useFocusTrap` around the element it renders as
 *    `children`. Two different a11y patterns, one shared positioning primitive.
 *
 * No exit animation, matching `shared/ui/Modal`'s existing precedent (`if (!open) return null`,
 * nothing to clean up on the way out) — only the entrance fades in, and its duration comes from
 * `--dur-fast` so `prefers-reduced-motion` collapses it to 1ms automatically (see `index.css`).
 */
export function Popover({
  open,
  onClose,
  anchorRef,
  children,
  matchAnchorWidth = false,
  className = '',
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<Position | null>(null)

  const recompute = useCallback(() => {
    const anchor = anchorRef.current
    const panel = panelRef.current
    if (!anchor || !panel) return
    const next = computePosition(
      anchor.getBoundingClientRect(),
      panel.getBoundingClientRect(),
      matchAnchorWidth,
      window.innerWidth,
      window.innerHeight,
    )
    // Bail out (return the SAME object) when nothing actually moved. The effect below has no
    // dependency array on purpose — it re-measures on every render so a panel that resizes (an
    // option list changing) stays correctly placed — so without this check, `setPosition` would
    // hand back a new object every time, `useLayoutEffect` would never see a stable render to
    // stop at, and the two would loop forever.
    //
    // Compared with a sub-pixel tolerance rather than `===` because the measured rect is a float:
    // at a fractional device pixel ratio (browser zoom, 125% Windows scaling) a width we applied
    // can be read back a hundredth of a pixel off, which `===` would treat as "it moved" forever.
    // Half a pixel is below what any display can show, so nothing visible is being discarded.
    setPosition((prev) => (prev && samePosition(prev, next) ? prev : next))
  }, [anchorRef, matchAnchorWidth])

  // Measure synchronously after the (invisible) panel has laid out, so the very first visible
  // frame is already in the right place — no flash-then-jump.
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }
    recompute()
  })

  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', recompute)
    window.addEventListener('scroll', recompute, true)
    return () => {
      window.removeEventListener('resize', recompute)
      window.removeEventListener('scroll', recompute, true)
    }
  }, [open, recompute])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return
      onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
      anchorRef.current?.focus()
    }

    // Capture phase: a click inside the panel that also closes something else (e.g. selecting an
    // option) must not race this listener.
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open, onClose, anchorRef])

  if (!open) return null

  return createPortal(
    // Two elements on purpose, and they must stay two.
    //
    // OUTER = geometry. It is the element `panelRef` measures and the element the measurement is
    // written back to (`top`/`left`/`width`). It must never carry a `transform`, because
    // `getBoundingClientRect()` returns the VISUALLY transformed box: measuring an element that is
    // mid-`scale()` and then writing that reading into its layout `width` feeds the scale factor
    // back into the geometry. `width` is not a transitioned property, so it applies instantly,
    // while the entrance transition has not advanced by a single frame between two synchronous
    // `useLayoutEffect` passes — so every pass multiplied the width by the scale factor again
    // (0.98, 0.9604, …), `setPosition` never repeated itself, the bail-out above never fired and
    // the whole thing looped until React threw "Maximum update depth exceeded".
    //
    // INNER = appearance. The entrance animation and all caller chrome live here. A transform on
    // this element cannot disturb the measurement, because a child's transform does not affect its
    // parent's layout box. Its width is auto, so it fills whatever the outer element resolved to
    // (and, before any width is applied, the outer shrink-to-fits around it — that is how the
    // natural width gets measured in the first place).
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        width: position?.width,
        visibility: position ? 'visible' : 'hidden',
      }}
      className="z-50"
    >
      <div
        style={{
          opacity: position ? 1 : 0,
          transform: position ? 'translateY(0) scale(1)' : 'translateY(-4px) scale(0.98)',
          transitionProperty: 'opacity, transform',
          transitionDuration: 'var(--dur-fast)',
          transitionTimingFunction: 'var(--ease-out-soft)',
        }}
        className={className}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
