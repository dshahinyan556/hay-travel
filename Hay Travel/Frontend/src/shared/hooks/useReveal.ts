import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

/**
 * How far into the viewport the element must come before it reveals.
 *
 * `threshold: 0` + a negative bottom margin, deliberately NOT a percentage threshold: the map
 * (`aspect-ratio: 1000/1009`) and a card grid on a 375px screen are both TALLER than the viewport,
 * and an element taller than the viewport can never reach `threshold: 0.15` — it would stay
 * invisible forever. A root margin measures the same "is it properly on screen" intent in a way
 * that does not depend on the element's own height.
 */
const REVEAL_ROOT_MARGIN = '0px 0px -10% 0px'

export interface UseRevealOptions {
  /** Override the viewport inset. Defaults to `'0px 0px -10% 0px'` — see the note above. */
  rootMargin?: string
  /** Reveal immediately, skipping the observer. For content that is above the fold by definition. */
  immediate?: boolean
}

export interface UseRevealResult<T extends HTMLElement> {
  /** Attach to the element that should reveal. */
  ref: RefObject<T | null>
  /** Flips to `true` once and never back. */
  revealed: boolean
}

/**
 * Fires once, the first time an element scrolls into view.
 *
 * ── One-way on purpose ────────────────────────────────────────────────────────────────────────
 * The target is unobserved the moment it reveals, so scrolling back up and down again does not
 * replay anything. A page that re-animates on every pass reads as a page that is broken, not as a
 * page that is alive.
 *
 * ── No reduced-motion branch here ─────────────────────────────────────────────────────────────
 * This hook only flips an attribute; the actual movement is `.reveal`/`.reveal-group` in
 * `index.css`, whose duration and stagger are tokens that collapse under
 * `prefers-reduced-motion`. Keeping the branch in CSS means there is exactly one place that
 * decides, and the hook cannot drift from it.
 *
 * Usually reached through `shared/ui/Reveal`; use the hook directly only when the element that
 * reveals must also be the one that owns some other ref-driven behaviour.
 */
export function useReveal<T extends HTMLElement = HTMLElement>({
  rootMargin = REVEAL_ROOT_MARGIN,
  immediate = false,
}: UseRevealOptions = {}): UseRevealResult<T> {
  const ref = useRef<T>(null)
  const [revealed, setRevealed] = useState(immediate)

  useEffect(() => {
    if (revealed) return
    const node = ref.current
    if (!node) return

    // No observer (very old browser, a test environment): show the content. Content staying
    // invisible is the one outcome this feature must never produce.
    if (typeof IntersectionObserver === 'undefined') {
      setRevealed(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          observer.unobserve(entry.target)
          setRevealed(true)
        }
      },
      { root: null, rootMargin, threshold: 0 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [revealed, rootMargin])

  return { ref, revealed }
}
