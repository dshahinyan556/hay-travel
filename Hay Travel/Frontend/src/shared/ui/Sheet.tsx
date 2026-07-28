import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useBodyScrollLock, useFocusTrap } from '@/shared/hooks'

/**
 * Sheet position, expressed as a percentage of the sheet's own height:
 * `0` = fully expanded, `100` = completely off-screen. Percentages (not pixels) because that is
 * what `translateY` takes, so the sheet works at any viewport height without measuring it.
 */
const CLOSED_OFFSET = 100

const SETTLE_MS = 320
const SETTLE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'
/** px/ms at release. Above this the gesture reads as a flick and beats the distance dragged. */
const FLICK_VELOCITY = 0.5
/** Trailing window the release velocity is measured over, and the floor for its divisor. */
const VELOCITY_WINDOW_MS = 60
const VELOCITY_MIN_ELAPSED_MS = 16
/** Pointer travel (px) under which the gesture is a tap, not a drag. */
const TAP_SLOP = 6
/** How far past `half` a slow drag must go before releasing closes the sheet. */
const CLOSE_MARGIN = 14
/** Existing region-panel padding, kept as the floor in the bottom-padding formula below. */
const SHEET_BOTTOM_PADDING = '1.5rem'

export type Detent = 'half' | 'full'
type SnapTarget = Detent | 'closed'

/**
 * The two offsets (in % of the sheet's own height) the sheet can rest at, expanded (`full`) and
 * partially open (`half`). Pass the same number for both to get a single-detent sheet — dragging
 * still works (past `CLOSE_MARGIN` closes it, otherwise it springs back open), the handle's
 * tap-to-toggle just becomes a no-op because there is nowhere else to go. This is the right shape
 * for a popup-style sheet (option list, calendar) that shouldn't have a "half" resting state.
 */
export const SHEET_SINGLE_DETENT = { half: 0, full: 0 }

interface Gesture {
  pointerId: number
  /** Sheet height in px, sampled once at gesture start — px → % conversion for the drag. */
  height: number
  startY: number
  startOffset: number
  startDetent: Detent
  /** Rolling sample used for release velocity. */
  sampleY: number
  sampleTime: number
  moved: boolean
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

/**
 * Where the sheet lands when the finger lifts. Pure — the whole snap policy in one readable place.
 *
 * A flick moves the sheet exactly one detent in the direction of the throw, which is why a quick
 * downward flick from `half` closes it even if the sheet barely moved. A slow drag is resolved by
 * position instead: nearest detent, with `CLOSE_MARGIN` of slack so "closed" is reachable without
 * having to drag the sheet almost off the screen.
 */
function resolveTarget(
  offset: number,
  velocity: number,
  from: Detent,
  fullOffset: number,
  halfOffset: number,
): SnapTarget {
  if (velocity <= -FLICK_VELOCITY) return 'full'
  if (velocity >= FLICK_VELOCITY) return from === 'full' ? 'half' : 'closed'
  if (offset >= halfOffset + CLOSE_MARGIN) return 'closed'
  return offset <= (fullOffset + halfOffset) / 2 ? 'full' : 'half'
}

export interface SheetProps {
  open: boolean
  /** Called when the sheet should go away — backdrop, swipe-down or flick-down. */
  onClose: () => void
  /** Accessible name of the dialog. */
  ariaLabel: string
  children: React.ReactNode
  /**
   * Offsets (in % of the sheet's own height) for the two detents. Defaults to the region panel's
   * shape (`half: 38, full: 0`). Pass `SHEET_SINGLE_DETENT` for a sheet with one resting position.
   */
  detents?: { half: number; full: number }
  /** Which detent the sheet opens into. Default `'half'`. */
  initialDetent?: Detent
  /**
   * Fixed sheet height in `dvh`. Use this for a long scrollable list that should fill a stable
   * viewport fraction (the region tour list uses 88). Omit it to size the sheet to its content
   * instead (capped at 85dvh with internal scroll) — right for a calendar grid or a short list.
   */
  heightDvh?: number
  /** Extra classes for the sheet's root element (background/rounding already provided). */
  className?: string
  /** Accessible name for the backdrop's close button. Default `'Закрыть'`. */
  backdropLabel?: string
  /** Accessible name for the drag handle when tapping it would expand the sheet. */
  expandLabel?: string
  /** Accessible name for the drag handle when tapping it would collapse the sheet. */
  collapseLabel?: string
}

/**
 * Draggable bottom sheet — generic overlay primitive, mobile/compact-viewport counterpart to
 * `Popover`. Originally written for the region panel (`RegionSheet`, still its thin wrapper here)
 * and lifted here so `Select`/`DatePicker` can reuse it on compact viewports without one feature
 * importing another (forbidden by this project's architecture — see `shared/hooks/index.ts`).
 *
 * ── Why the gesture is hand-rolled ────────────────────────────────────────────────────────────
 * framer-motion's `drag` is deliberately NOT used here: this sheet already lost its enter
 * animation once to framer (it applied the initial state and stayed parked at `translateY(100%)`
 * — see the note in `index.css`). Pointer events give the exact same behaviour in ~60 lines with
 * no library state machine in the middle.
 *
 * Pointer capture is also avoided on purpose: capturing retargets the follow-up `click`, which
 * would break a close button or a link inside the sheet. Instead the move/up listeners live on
 * `window` for the duration of the gesture only.
 *
 * ── Two detents ───────────────────────────────────────────────────────────────────────────────
 * `half` (opening position) and `full` by default. Drag up → `full`; drag down → `half`, then
 * closed. The sheet tracks the finger 1:1 while dragging (transition off), then transitions to
 * the resolved detent on release. Tapping the handle toggles half/full, which also gives keyboard
 * users the same control. Pass equal `detents` to collapse this to a single resting position.
 *
 * ── Scroll vs. drag ───────────────────────────────────────────────────────────────────────────
 * A gesture that starts inside `[data-sheet-scroll]` (the caller's scrollable content) is left to
 * the browser, so a scrolled list never fights the sheet. Everything else — handle and any header
 * — drags the sheet.
 *
 * ── Enter/exit ────────────────────────────────────────────────────────────────────────────────
 * The element mounts at `CLOSED_OFFSET`, a forced reflow flushes that as the transition's start
 * value, and the offset then moves to `initialDetent` — a real enter animation without keyframes.
 * On close the parent flips `open` to false, the sheet transitions back down and unmounts after
 * `SETTLE_MS`.
 */
export function Sheet({
  open,
  onClose,
  ariaLabel,
  children,
  detents = { half: 38, full: 0 },
  initialDetent = 'half',
  heightDvh,
  className = '',
  backdropLabel = 'Закрыть',
  expandLabel = 'Развернуть',
  collapseLabel = 'Свернуть',
}: SheetProps) {
  const { half: HALF_OFFSET, full: FULL_OFFSET } = detents

  const [mounted, setMounted] = useState(false)
  const [offset, setOffsetState] = useState(CLOSED_OFFSET)
  const [detent, setDetent] = useState<Detent>(initialDetent)
  const [dragging, setDragging] = useState(false)

  const sheetRef = useRef<HTMLDivElement>(null)
  // Mirrors of the two pieces of state the gesture listeners read: they are attached once per
  // gesture and must not be re-created on every animation frame.
  const offsetRef = useRef(CLOSED_OFFSET)
  const detentRef = useRef<Detent>(initialDetent)
  const gestureRef = useRef<Gesture | null>(null)
  const swallowClickRef = useRef(false)
  // The caller drops its content the moment it closes the sheet; the sheet still has an exit
  // animation to play, and sliding an empty box down would look broken. So the last live content
  // is kept for the duration of that animation.
  const lastContentRef = useRef<React.ReactNode>(null)

  const setOffset = useCallback((value: number) => {
    offsetRef.current = value
    setOffsetState(value)
  }, [])

  const settleAt = useCallback(
    (next: Detent) => {
      detentRef.current = next
      setDetent(next)
      setOffset(next === 'full' ? FULL_OFFSET : HALF_OFFSET)
    },
    [setOffset, FULL_OFFSET, HALF_OFFSET],
  )

  // Mount on open; keep mounted until the exit transition has run.
  useEffect(() => {
    if (open) {
      setMounted(true)
      return
    }
    setOffset(CLOSED_OFFSET)
    const timer = window.setTimeout(() => setMounted(false), SETTLE_MS)
    return () => window.clearTimeout(timer)
  }, [open, setOffset])

  useLayoutEffect(() => {
    if (!open || !mounted) return
    const node = sheetRef.current
    if (!node) return
    // Park off-screen and flush it to the style engine, so moving to the initial detent below is
    // a genuine transition start rather than the element's first painted frame.
    node.style.transform = `translateY(${CLOSED_OFFSET}%)`
    void node.offsetHeight
    settleAt(initialDetent)
    // Deliberately keyed on open/mount only, not on `initialDetent` — it is read once per open
    // (mirroring the original `RegionSheet`, which always opened into `'half'`), not tracked live;
    // re-running this whenever the prop's identity changes would reset the sheet's position while
    // still open.
  }, [open, mounted, settleAt])

  useEffect(() => {
    if (open) lastContentRef.current = children
  }, [open, children])

  useBodyScrollLock(mounted)
  useFocusTrap(sheetRef, open && mounted)

  // Escape dismisses the sheet the same way the backdrop does. Focus return to whatever opened
  // it is already handled by `useFocusTrap`'s own cleanup (it restores `previouslyFocused` the
  // moment `open && mounted` goes false, which happens immediately — not after the exit
  // animation), so there is nothing extra to do here.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    // The caller's scrollable content owns vertical gestures that start inside it.
    if ((event.target as HTMLElement).closest('[data-sheet-scroll]')) return

    const height = sheetRef.current?.offsetHeight ?? 0
    if (height === 0) return

    swallowClickRef.current = false
    gestureRef.current = {
      pointerId: event.pointerId,
      height,
      startY: event.clientY,
      startOffset: offsetRef.current,
      startDetent: detentRef.current,
      sampleY: event.clientY,
      sampleTime: event.timeStamp,
      moved: false,
    }
    setDragging(true)
  }, [])

  useEffect(() => {
    if (!dragging) return

    const onMove = (event: PointerEvent) => {
      const gesture = gestureRef.current
      if (!gesture || event.pointerId !== gesture.pointerId) return

      const dy = event.clientY - gesture.startY
      if (!gesture.moved && Math.abs(dy) > TAP_SLOP) gesture.moved = true

      // Velocity is measured over a ~60ms trailing window: sampling every move makes it noisy
      // (a 3px twitch between two frames would read as a flick), while measuring the whole
      // gesture would miss a slow drag that ends in a flick.
      if (event.timeStamp - gesture.sampleTime > VELOCITY_WINDOW_MS) {
        gesture.sampleY = event.clientY
        gesture.sampleTime = event.timeStamp
      }

      setOffset(
        clamp(gesture.startOffset + (dy / gesture.height) * 100, FULL_OFFSET, CLOSED_OFFSET),
      )
    }

    const onUp = (event: PointerEvent) => {
      const gesture = gestureRef.current
      // A second finger lifting must not end the gesture that the first one owns.
      if (!gesture || event.pointerId !== gesture.pointerId) return
      gestureRef.current = null
      setDragging(false)

      if (!gesture.moved) {
        // A tap: leave the position untouched and let the handle's click handler decide.
        setOffset(gesture.startOffset)
        return
      }

      // A drag ending on the handle still fires a click — the handle must ignore that one.
      swallowClickRef.current = true

      const elapsed = Math.max(VELOCITY_MIN_ELAPSED_MS, event.timeStamp - gesture.sampleTime)
      const velocity = (event.clientY - gesture.sampleY) / elapsed
      const target = resolveTarget(
        offsetRef.current,
        velocity,
        gesture.startDetent,
        FULL_OFFSET,
        HALF_OFFSET,
      )

      if (target === 'closed') {
        setOffset(CLOSED_OFFSET)
        onClose()
        return
      }
      settleAt(target)
    }

    // The browser took the gesture over (system back-swipe, incoming call): put the sheet back
    // where the gesture started rather than leaving it mid-drag.
    const onCancel = (event: PointerEvent) => {
      const gesture = gestureRef.current
      if (!gesture || event.pointerId !== gesture.pointerId) return
      gestureRef.current = null
      setDragging(false)
      setOffset(gesture.startOffset)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [dragging, onClose, setOffset, settleAt, FULL_OFFSET, HALF_OFFSET])

  const handleToggle = () => {
    if (swallowClickRef.current) {
      swallowClickRef.current = false
      return
    }
    settleAt(detentRef.current === 'full' ? 'half' : 'full')
  }

  if (!mounted) return null

  // Fades out in step with the drag, so a swipe-to-close reads as one continuous motion.
  const backdropOpacity = 1 - clamp((offset - HALF_OFFSET) / (CLOSED_OFFSET - HALF_OFFSET), 0, 1)
  const settle = dragging ? 'none' : `transform ${SETTLE_MS}ms ${SETTLE_EASING}`

  const paddingExtraDvh =
    heightDvh !== undefined
      ? ((detent === 'full' ? FULL_OFFSET : HALF_OFFSET) / 100) * heightDvh
      : 0

  return (
    // Mounted only on compact viewports — the parent owns that gate, so no `lg:hidden` here:
    // a CSS-hidden sheet would still lock the page scroll and trap focus.
    <div className="fixed inset-0 z-40 flex items-end">
      <button
        type="button"
        aria-label={backdropLabel}
        onClick={onClose}
        style={{
          opacity: backdropOpacity,
          transition: dragging ? 'none' : `opacity ${SETTLE_MS}ms ease-out`,
        }}
        className="absolute inset-0 cursor-pointer bg-obsidian/70 backdrop-blur-sm"
      />

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        onPointerDown={handlePointerDown}
        style={{
          height: heightDvh !== undefined ? `${heightDvh}dvh` : undefined,
          maxHeight: heightDvh === undefined ? '85dvh' : undefined,
          transform: `translateY(${offset}%)`,
          transition: settle,
        }}
        className={`relative flex w-full flex-col rounded-t-3xl bg-panel ring-1 ring-edge outline-none ${className}`}
      >
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={detent === 'full'}
          aria-label={detent === 'full' ? collapseLabel : expandLabel}
          // `touch-none` keeps the browser from claiming the vertical swipe on this strip.
          // The generous padding is what makes a 6px bar a comfortable 44px touch target.
          className="flex w-full shrink-0 cursor-grab touch-none items-center justify-center rounded-t-3xl py-4 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none active:cursor-grabbing"
        >
          <span aria-hidden="true" className="h-1.5 w-11 rounded-full bg-edge" />
        </button>

        {/*
          `min-h-0` is what lets the caller's inner content scroll instead of stretching the sheet.

          The bottom padding absorbs the part of the sheet that is currently pushed below the
          fold, so a scrollable child ends where the screen ends. Without it the last items in a
          half-open sheet would scroll into the off-screen strip and be unreachable. It follows
          the settled detent rather than the live drag offset — recomputing padding on every
          pointermove would relayout the content 60 times a second for no visual gain. It is a
          no-op (just the base padding) when `heightDvh` is not set, since there both detents
          resolve to the same on-screen height already.
        */}
        <div
          className="flex min-h-0 flex-1 flex-col px-4"
          style={{ paddingBottom: `calc(${SHEET_BOTTOM_PADDING} + ${paddingExtraDvh}dvh)` }}
        >
          {open ? children : lastContentRef.current}
        </div>
      </div>
    </div>
  )
}
