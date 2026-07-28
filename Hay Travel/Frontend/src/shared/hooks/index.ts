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
export { useBodyScrollLock } from './useBodyScrollLock'
export { useFocusTrap } from './useFocusTrap'
export { useDeferredCommit, type DeferredCommit } from './useDeferredCommit'
