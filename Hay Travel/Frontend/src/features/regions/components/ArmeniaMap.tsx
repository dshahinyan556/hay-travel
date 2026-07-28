import { useState } from 'react'
import { motion } from 'framer-motion'
import { REGIONS, MAP_VIEWBOX, type RegionSlug } from '@/shared/data/armeniaRegions'
// Geometry is a separate module so it only loads with the map — see `regionGeometry.ts`.
import { REGION_GEOMETRY, SEVAN_GEOMETRY } from '@/shared/data/regionGeometry'
import { formatTourCount } from '@/shared/lib/format'
import { useIsTouchDevice } from '@/shared/hooks'

interface ArmeniaMapProps {
  selected: RegionSlug | null
  onSelect: (slug: RegionSlug) => void
  /** Product count per region slug — drives tooltips and dims empty regions. */
  counts: Record<string, number>
  /** Tap on the map background (no region hit) — used to drop the mobile highlight. */
  onDismiss?: () => void
}

/**
 * Radius, in viewBox units, of the invisible touch target drawn over an enclave.
 *
 * Yerevan's real outline is ~70×69 units of a 1000-unit-wide map, i.e. ~21px on a 375px phone —
 * far below the 44px minimum for a finger. 64 units is ~40px across at that width and grows with
 * the screen. It costs a thin ring of Ararat/Armavir/Kotayk around the capital: a tap that lands
 * within ~10 units of Yerevan's border now selects Yerevan, which is what the user aimed at.
 * Touch only — a mouse is precise enough for the real shape.
 */
const ENCLAVE_TOUCH_RADIUS = 64

/**
 * Paint order for the region shapes: enclaves last. Yerevan is cut out of its neighbours, so it
 * is never covered by their fill — but a selected neighbour's 3px stroke would run over the
 * capital's own outline. Drawing it on top keeps the smallest shape readable. Computed once:
 * `REGIONS` is a static module constant.
 */
const PAINT_ORDER = [...REGIONS].sort(
  (a, b) => Number(Boolean(a.isEnclave)) - Number(Boolean(b.isEnclave)),
)

/**
 * Clickable SVG map of Armenia's 11 regions.
 *
 * ── Focus, and why there is no rectangle ──────────────────────────────────────────────────
 * The client flagged a stray box appearing around a province on click. That was the browser's
 * default focus ring: on an SVG path, `outline` is drawn around the BOUNDING BOX, so on an
 * irregular shape it reads as a random rectangle rather than a highlight.
 *
 * The fix is not to silently kill focus — that would strip keyboard navigation. Instead
 * `.region-path` (in `index.css`) sets `outline: none` and re-expresses `:focus-visible` as a
 * gold stroke on the shape itself. Tab still walks the regions, Enter/Space still selects.
 *
 * ── Geometry ──────────────────────────────────────────────────────────────────────────────
 * Real borders from geoBoundaries ADM1 (see `shared/data/armeniaRegions.ts`). Every region is
 * filled from its own path, Yerevan included: it is a small enclave, cut out of its neighbours'
 * shapes, so while it was filtered out of this loop a tap on the capital fell through a hole in
 * the map and hit nothing at all. It keeps its gold dot as a city marker (decorative), and on
 * touch devices gets an oversized invisible hit circle on top — see `ENCLAVE_TOUCH_RADIUS`.
 *
 * Labels are drawn with `paint-order: stroke` and a halo stroke in the page's own tone
 * (`--map-label-halo`), which keeps names legible wherever they sit — over a plain region fill,
 * over the wine fill of a selected one, or over a gap in the map.
 *
 * ── Colour ────────────────────────────────────────────────────────────────────────────────
 * Every colour here is a `var(--map-*)` token declared per theme in `index.css`. They are read
 * as raw CSS vars rather than Tailwind classes because these are SVG presentation attributes
 * (`fill`/`stroke`) driven by component state, not static classes.
 */
export function ArmeniaMap({ selected, onSelect, counts, onDismiss }: ArmeniaMapProps) {
  const [hovered, setHovered] = useState<RegionSlug | null>(null)
  const isTouch = useIsTouchDevice()
  const activeSlug = hovered ?? selected
  const active = activeSlug ? REGIONS.find((r) => r.slug === activeSlug) : null

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
        className="h-auto w-full"
        role="group"
        aria-label="Карта регионов Армении"
        // Gaps between provinces belong to the <svg> itself; a tap there means "never mind".
        onClick={(event) => {
          if (event.target === event.currentTarget) onDismiss?.()
        }}
      >
        {PAINT_ORDER.map((region) => {
          const isSelected = selected === region.slug
          const isHovered = hovered === region.slug
          // Regions with nothing to sell stay legible but visibly quieter. Expressed as a
          // dedicated FILL rather than `opacity`, which also faded the outline and the label
          // and turned the region into a washed-out blot in the light theme.
          const isMuted = (counts[region.slug] ?? 0) === 0 && !isSelected && !isHovered

          return (
            <path
              key={region.slug}
              d={REGION_GEOMETRY[region.slug]}
              className="region-path cursor-pointer"
              fillRule="evenodd"
              fill={
                isSelected
                  ? 'var(--map-region-selected-fill)'
                  : isHovered
                    ? 'var(--map-region-hover-fill)'
                    : isMuted
                      ? 'var(--map-region-muted-fill)'
                      : 'var(--map-region-fill)'
              }
              stroke={
                isSelected
                  ? 'var(--map-region-stroke-selected)'
                  : isHovered
                    ? 'var(--map-region-stroke-hover)'
                    : 'var(--map-region-stroke)'
              }
              strokeWidth={isSelected ? 3 : isHovered ? 2 : 1.4}
              tabIndex={0}
              role="button"
              aria-pressed={isSelected}
              aria-label={`${region.ru} — ${formatTourCount(counts[region.slug] ?? 0)}`}
              onClick={() => onSelect(region.slug)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(region.slug)
                }
              }}
              onMouseEnter={() => setHovered(region.slug)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(region.slug)}
              onBlur={() => setHovered(null)}
            />
          )
        })}

        {/*
          Lake Sevan — decorative water body drawn over Gegharkunik's fill. `pointer-events: none`
          so a tap on the lake falls through to the Gegharkunik <path> beneath it (the lake is part
          of that province). Sits below the labels, which are drawn last and keep their halo, so the
          "Гегаркуник" label stays legible where it overlaps the water.
        */}
        <path
          d={SEVAN_GEOMETRY}
          fill="var(--map-water-fill)"
          stroke="var(--map-water-stroke)"
          strokeWidth={1.2}
          className="pointer-events-none"
          aria-hidden="true"
        />

        {/*
          Enlarged touch targets for the enclaves, drawn above every shape so they win hit-testing.
          `fill="none"` with `pointer-events="all"` — invisible, but still hittable in every engine.
          Not focusable and hidden from assistive tech: the real <path> above already exposes the
          region as a button, this is only a finger-sized proxy for it.
        */}
        {isTouch &&
          REGIONS.filter((region) => region.isEnclave).map((region) => (
            <circle
              key={`hit-${region.slug}`}
              cx={region.labelAt[0]}
              cy={region.labelAt[1]}
              r={ENCLAVE_TOUCH_RADIUS}
              fill="none"
              pointerEvents="all"
              className="cursor-pointer"
              aria-hidden="true"
              onClick={() => onSelect(region.slug)}
            />
          ))}

        {/* Labels sit above every shape so a selected neighbour can't cover them. */}
        {REGIONS.map((region) => {
          const isSelected = selected === region.slug
          const isActive = activeSlug === region.slug
          const [x, y] = region.labelAt

          return (
            <g key={`label-${region.slug}`} className="pointer-events-none">
              {region.isEnclave && (
                <circle
                  cx={x}
                  cy={y}
                  r={isActive ? 11 : 8}
                  // Gold on the wine fill of a selected Yerevan — the old wine dot vanished
                  // into it, making the capital look unselected while it was. Reuses the
                  // region-stroke tokens: they are the map's gold, already tuned per theme.
                  fill={
                    isSelected
                      ? 'var(--map-region-stroke-selected)'
                      : 'var(--map-region-stroke-hover)'
                  }
                  stroke="var(--map-label-halo)"
                  strokeWidth={2}
                />
              )}
              <text
                x={x}
                y={region.isEnclave ? y - 18 : y + 6}
                textAnchor="middle"
                className="font-display select-none"
                fontSize={isActive ? 30 : 25}
                // Hover/selection lifts the label to the theme's strong accent; the halo below
                // is what keeps it readable over the wine fill of a selected region.
                fill={isActive ? 'var(--accent-strong)' : 'var(--map-label)'}
                paintOrder="stroke"
                stroke="var(--map-label-halo)"
                strokeWidth={6}
              >
                {region.ru}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Hover/selection readout. Rendered as HTML rather than SVG text so it can use the
          normal type scale and wrap naturally on narrow screens. */}
      {active && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="pointer-events-none absolute top-3 left-3 max-w-[70%] rounded-xl bg-map-tooltip-bg px-3.5 py-2.5 shadow-[var(--shadow-md)] ring-1 ring-map-tooltip-edge backdrop-blur-sm"
        >
          <p className="font-display text-lg leading-tight text-accent-strong">{active.ru}</p>
          <p className="mt-0.5 text-xs text-map-tooltip-text-muted">{active.blurb}</p>
          <p className="mt-1 text-xs text-gold-ink">{formatTourCount(counts[active.slug] ?? 0)}</p>
        </motion.div>
      )}
    </div>
  )
}
