import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { REGION_BY_SLUG, type RegionSlug } from '@/shared/data/armeniaRegions'
import { countToursByRegion, getToursByRegion } from '@/shared/api/tours'
import { useIsCompactViewport } from '@/shared/hooks'
import type { Tour } from '@/shared/types/tour'
import { RegionPanel, type RegionPanelState } from './RegionPanel'
import { RegionPreviewBar } from './RegionPreviewBar'
import { RegionSheet } from './RegionSheet'
import { ChevronDownIcon, MapIcon } from '@/shared/ui/icons'

/**
 * The map carries ~37KB of province geometry, and on the home page it starts collapsed — so it
 * is code-split and only fetched when the section is actually opened. `Suspense` covers the
 * one-time load with a skeleton the same height as the map, so opening it doesn't jump.
 */
const ArmeniaMap = lazy(() =>
  import('./ArmeniaMap').then((m) => ({ default: m.ArmeniaMap })),
)

interface RegionExplorerProps {
  /** All tours, used to compute per-region counters for the map. */
  tours: readonly Tour[]
  /**
   * Whether the map starts open. The home page teaser keeps it collapsed behind a button
   * (the client's ask), while the dedicated `/regions` page opens straight into the map —
   * having navigated there, being asked to click again would be pointless.
   */
  defaultOpen?: boolean
}

/**
 * A region is picked in two stages, not one.
 *
 * `preview` — highlighted on the map, confirmation bar showing, nothing fetched yet.
 * `opened`  — panel/sheet is up and the region's tours are loading or loaded.
 *
 * One field with a stage rather than two booleans: "highlighted" and "opened" are positions of
 * the same selection, never two independent things, so they cannot drift out of sync.
 */
type RegionSelection = { slug: RegionSlug; stage: 'preview' | 'opened' }

/**
 * The site's main interactive module: collapse → expand → hover → select region → open tours.
 *
 * Region tours are fetched per selection rather than sliced from the `tours` prop, because
 * that is what the real endpoint will do (`GetToursClient` filtered by region) — so the
 * loading/error states here are the ones that will actually run in production, not decoration.
 *
 * Layout: on `lg+` the panel is a sticky column beside the map; below that it becomes a
 * bottom sheet, since a side column at 375px would leave the map unusably narrow.
 *
 * The same breakpoint decides the interaction model. On a pointer device a click opens the panel
 * immediately — hover already told the visitor what they were about to click. On a compact
 * viewport there is no hover, so the first tap only highlights the region and raises
 * `RegionPreviewBar`; the panel opens from its button, or from a second tap on the same region.
 * The gate is `useIsCompactViewport`, whose query mirrors Tailwind's `lg`, so the JS behaviour
 * and the `lg:` classes below can never disagree.
 */
export function RegionExplorer({ tours, defaultOpen = false }: RegionExplorerProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [selection, setSelection] = useState<RegionSelection | null>(null)
  const [panel, setPanel] = useState<RegionPanelState>({ status: 'loading' })
  const isCompact = useIsCompactViewport()

  const counts = countToursByRegion(tours)

  const loadRegion = useCallback((slug: RegionSlug) => {
    setPanel({ status: 'loading' })
    getToursByRegion(slug)
      .then((result) => setPanel({ status: 'ready', tours: result }))
      .catch(() => setPanel({ status: 'error' }))
  }, [])

  /** Confirms a region: opens the panel and starts the fetch. */
  const openRegion = useCallback(
    (slug: RegionSlug) => {
      setSelection({ slug, stage: 'opened' })
      loadRegion(slug)
    },
    [loadRegion],
  )

  const handleSelect = useCallback(
    (slug: RegionSlug) => {
      // Clicking the region that is already open toggles it back off — the map returns to
      // "nothing selected". On desktop that is the second click on the highlighted region;
      // on compact it is the tap after preview → open.
      if (selection?.slug === slug && selection.stage === 'opened') {
        setSelection(null)
        return
      }
      // Desktop: one click, straight into the panel. Compact: highlight first, unless this is a
      // second tap on the region that is already highlighted.
      if (!isCompact || selection?.slug === slug) {
        openRegion(slug)
        return
      }
      setSelection({ slug, stage: 'preview' })
    },
    [isCompact, openRegion, selection?.slug, selection?.stage],
  )

  const clearSelection = useCallback(() => setSelection(null), [])

  /** Tap on empty map space drops a preview, but never closes an open panel. */
  const dismissPreview = useCallback(() => {
    setSelection((current) => (current?.stage === 'preview' ? null : current))
  }, [])

  // Escape clears the selection at either stage — expected of any sheet/overlay.
  useEffect(() => {
    if (!selection) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelection(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selection])

  const selectedRegion = selection ? REGION_BY_SLUG[selection.slug] : null
  const openedRegion = selection?.stage === 'opened' ? REGION_BY_SLUG[selection.slug] : null
  const previewRegion = selection?.stage === 'preview' ? REGION_BY_SLUG[selection.slug] : null

  return (
    <>
      {/*
        Full-bleed ribbon (2.3): the map's own strip is a shade lighter than the page and carries
        the veil wash, running edge to edge — only the content INSIDE it (the rounded card) keeps
        the site's usual `max-w-7xl` measure. `.ribbon-veil` fades page → panel → panel → page, so
        the strip reads as a band rather than a hard-edged block. The compact sheet/preview-bar
        overlays below are siblings, not nested inside it — they are fixed-position overlays with
        their own side effects (scroll lock, focus trap) and have no business inside the ribbon's
        DOM, which exists purely for the background gradient's box.
      */}
      <section className="ribbon-veil relative w-full overflow-hidden py-24 sm:py-32">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-16">
          <div className="rounded-3xl bg-panel/60 p-5 ring-1 ring-edge sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="section-eyebrow">Интерактивная карта</p>
                <h2 className="text-gold-sheen h2-section mt-1.5">Армения по регионам</h2>
                <p className="mt-2 max-w-md text-sm text-ink-muted">
                  11 регионов, у каждого свой характер. Выберите регион на карте — покажем, что
                  можно посмотреть именно там.
                </p>
              </div>

              {!defaultOpen && (
                <button
                  type="button"
                  onClick={() => setOpen((v) => !v)}
                  aria-expanded={open}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-gold-fill px-5 py-2.5 text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-page focus-visible:outline-none"
                >
                  <MapIcon size={17} />
                  {open ? 'Свернуть карту' : 'Исследовать по регионам'}
                  <motion.span animate={{ rotate: open ? 180 : 0 }} className="inline-flex">
                    <ChevronDownIcon size={16} />
                  </motion.span>
                </button>
              )}
            </div>

            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  key="map"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  // `overflow-hidden` is what makes the height animation clip cleanly.
                  className="overflow-hidden"
                >
                  <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                    <Suspense
                      fallback={
                        <div
                          className="animate-pulse rounded-2xl bg-panel-raised/60"
                          // Matches the map's intrinsic aspect ratio (1000×1009) to avoid a layout jump.
                          style={{ aspectRatio: '1000 / 1009' }}
                        />
                      }
                    >
                      <ArmeniaMap
                        // Highlighted at both stages: on mobile that highlight is the whole point of
                        // the preview step.
                        selected={selection?.slug ?? null}
                        onSelect={handleSelect}
                        onDismiss={dismissPreview}
                        counts={counts}
                      />
                    </Suspense>

                    {/* Desktop side panel */}
                    <div className="hidden lg:block">
                      {openedRegion ? (
                        <div className="sticky top-24 max-h-[70vh] rounded-2xl bg-panel p-4 ring-1 ring-edge">
                          <RegionPanel
                            region={openedRegion}
                            state={panel}
                            onClose={clearSelection}
                            onRetry={() => loadRegion(openedRegion.slug)}
                          />
                        </div>
                      ) : (
                        <div className="veil-top sticky top-24 rounded-2xl border border-dashed border-edge p-6 text-center">
                          <span className="inline-flex text-gold-ink">
                            <MapIcon size={26} />
                          </span>
                          <p className="mt-3 font-display text-lg text-ink">Выберите регион</p>
                          <p className="mt-1.5 text-sm text-ink-muted">
                            Наведите на регион, чтобы увидеть, сколько там маршрутов, и нажмите —
                            покажем список.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/*
        Compact viewport only, and mounted from JS rather than hidden with `lg:hidden`: both the
        confirmation bar and the sheet have side effects (scroll lock, focus trap), which a
        display:none element must never run.
      */}
      {isCompact && (
        <>
          <AnimatePresence>
            {previewRegion && open && (
              <RegionPreviewBar
                key={previewRegion.slug}
                region={previewRegion}
                tourCount={counts[previewRegion.slug] ?? 0}
                onOpen={() => openRegion(previewRegion.slug)}
                onDismiss={clearSelection}
              />
            )}
          </AnimatePresence>

          <RegionSheet
            open={selection?.stage === 'opened'}
            onClose={clearSelection}
            ariaLabel={`Регион ${selectedRegion?.ru ?? ''}`.trim()}
          >
            {selectedRegion && (
              <RegionPanel
                region={selectedRegion}
                state={panel}
                onClose={clearSelection}
                onRetry={() => loadRegion(selectedRegion.slug)}
              />
            )}
          </RegionSheet>
        </>
      )}
    </>
  )
}
