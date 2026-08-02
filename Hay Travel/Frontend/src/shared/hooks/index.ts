/**
 * Shared hooks barrel — cross-feature browser primitives only.
 *
 * Anything that knows about tours, regions or the admin panel belongs in that feature's own
 * `hooks/` folder (see `features/tours/hooks/useTourFilters`), not here.
 */
export {
  useMediaQuery,
  useIsCompactViewport,
  useIsTouchDevice,
  COMPACT_VIEWPORT_QUERY,
} from './useMediaQuery'
export { useReducedMotion, REDUCED_MOTION_QUERY } from './useReducedMotion'
export { useReveal } from './useReveal'
export type { UseRevealOptions, UseRevealResult } from './useReveal'
export { useBodyScrollLock } from './useBodyScrollLock'
export { useFocusTrap } from './useFocusTrap'
export { useDeferredCommit, type DeferredCommit } from './useDeferredCommit'
export { useUnsavedChangesGuard, type UnsavedChangesGuard } from './useUnsavedChangesGuard'
