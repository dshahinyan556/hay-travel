import { useCallback, useEffect, useRef, useState } from 'react'

/** Quiet period before a draft is committed outwards, in ms. Long enough to swallow a drag. */
const DEFAULT_DELAY_MS = 250

export interface DeferredCommit<T> {
  /** What the UI must render: the user's latest input, or `external` when nothing is in flight. */
  value: T
  /** Register user input: `value` updates now, `commit` runs after `delayMs` of quiet. */
  set: (next: T) => void
  /**
   * Show `next` immediately and drop any pending commit, *without* committing anything.
   *
   * For flows where the caller writes the external value itself and the local draft must not
   * fight it afterwards — e.g. a "reset everything" button that rewrites the whole URL.
   */
  sync: (next: T) => void
}

/**
 * Separates what the user sees from what the app commits.
 *
 * Made for controls that fire a continuous stream of input (a range slider, a search field)
 * while their value lives somewhere expensive to write — here, the URL, where every write is a
 * React Router navigation that re-runs route loaders. Rendering straight from that source makes
 * the control feel frozen until the stream stops; writing to it on every event will become a
 * flood of HTTP requests once the mock data source is replaced by the real API. So the draft is
 * local and instant, and the commit is debounced.
 *
 * The hard part is the way back: when `external` changes on its own — browser back/forward, a
 * reset, a link opened with parameters already in it — that change must win over the draft,
 * otherwise the control shows one value while the app filters by another. But `external` also
 * lags behind our *own* commits (a navigation takes as long as its loaders), and that lag must
 * NOT be mistaken for an outside change, or the control snaps back mid-drag. Hence two markers:
 * `seen` (the last `external` we reacted to) and `target` (the value we last pushed out). The
 * draft is dropped only when `external` actually moves to something we never asked for.
 */
export function useDeferredCommit<T>(
  external: T,
  commit: (value: T) => void,
  delayMs: number = DEFAULT_DELAY_MS,
): DeferredCommit<T> {
  // `null` means "no local edit, follow `external`". Wrapped in an object so `T` itself is free
  // to be `null` — for a price filter, `null` is a meaningful value ("no limit").
  const [draft, setDraft] = useState<{ value: T } | null>(null)
  const [seen, setSeen] = useState<T>(external)
  const [target, setTarget] = useState<T>(external)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Latest-ref for the callback: the commit fires from a timeout, long after the render that
  // scheduled it, and must use the current closure (fresh `setSearchParams`, fresh params).
  const commitRef = useRef(commit)
  useEffect(() => {
    commitRef.current = commit
  })

  const cancelPending = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Never let a scheduled commit fire into an unmounted tree.
  useEffect(() => cancelPending, [cancelPending])

  // Adjusting state during render rather than in an effect: an effect would leave one painted
  // frame showing the stale draft after a back/forward, which is the exact glitch this guards.
  if (external !== seen) {
    setSeen(external)
    if (external !== target) {
      cancelPending()
      setTarget(external)
      setDraft(null)
    }
  }

  const set = useCallback(
    (next: T) => {
      setDraft({ value: next })
      cancelPending()
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        setTarget(next)
        commitRef.current(next)
      }, delayMs)
    },
    [cancelPending, delayMs],
  )

  const sync = useCallback(
    (next: T) => {
      cancelPending()
      setDraft({ value: next })
      setTarget(next)
    },
    [cancelPending],
  )

  return { value: draft !== null ? draft.value : external, set, sync }
}
