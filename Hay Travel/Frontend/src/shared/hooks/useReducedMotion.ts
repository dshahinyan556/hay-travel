import { useMediaQuery } from './useMediaQuery'

/** The OS-level "reduce motion" setting, as a media query. Mirrors the block in `index.css`. */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/**
 * True when the visitor has asked their OS to reduce motion.
 *
 * Prefer CSS: the duration/easing tokens in `index.css` already collapse inside
 * `@media (prefers-reduced-motion: reduce)`, so anything animated with `--dur-*` needs no JS gate
 * at all. This hook exists only for the handful of places where the number lives in JavaScript and
 * cannot be a token — a `setTimeout` that must match a transition, a `framer-motion`
 * `transition.duration`, a stagger computed per index.
 *
 * What "reduced" must mean at the call site: the state change still happens (the sheet opens, the
 * tooltip shows), it just doesn't travel. Never gate the state change itself behind this.
 */
export function useReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION_QUERY)
}
