import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from 'react'
import { useReveal } from '@/shared/hooks'

/**
 * Tags a reveal is allowed to render as. A closed list rather than `ElementType`: `Reveal` is
 * polymorphic over this union only, so anything with its own required props beyond a plain DOM
 * element (`<img>`, `<a>` needing `href`, a component) has no business being one — it should wrap
 * in a `Reveal` instead.
 */
export type RevealTag =
  | 'div'
  | 'section'
  | 'article'
  | 'header'
  | 'footer'
  | 'aside'
  | 'nav'
  | 'figure'
  | 'ul'
  | 'ol'
  | 'li'
  | 'p'
  | 'span'

interface RevealOwnProps<Tag extends RevealTag> {
  /** Element to render. Default `'div'` — use `'section'`/`'header'`/`'ul'` to keep the outline honest. */
  as?: Tag
  /**
   * How far the block travels, in px. Default `18`. Use `24` for a heavy block (review panel,
   * booking card) so its entrance stays proportional to its weight.
   *
   * `'seam'` is the hairline variant instead: `scaleX(.2) → 1` from the centre, no fade — a `.seam`
   * carries its own `--seam-op` opacity and fading it would overwrite that.
   */
  rise?: number | 'seam'
  /**
   * Stagger mode. The container itself does not move; its descendants marked `.reveal-item` come in
   * as a wave, `--stagger` apart, when the container enters the viewport.
   *
   * Index comes from `:nth-child` automatically (capped at the 9th item) — set
   * `style={{ '--i': index } as CSSProperties}` on an item only when the items are not plain
   * siblings. Children mounted AFTER the container has revealed (catalog re-filter) appear
   * finished, without replaying the wave: see the note in `index.css`.
   */
  group?: boolean
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

/**
 * Every other attribute the underlying tag accepts (`aria-*`, `id`, `onClick`, …) is forwarded
 * straight through — `Reveal` used to only take `className`/`style`/`children`, which forced
 * decorative wrappers like `<div aria-hidden><Reveal .../></div>` at call sites just to attach an
 * ARIA attribute. `Omit` drops the reveal-owned keys so e.g. `style` on the element stays the one
 * merged with `--reveal-rise` below rather than a second, conflicting prop.
 */
export type RevealProps<Tag extends RevealTag = 'div'> = RevealOwnProps<Tag> &
  Omit<ComponentPropsWithoutRef<Tag>, keyof RevealOwnProps<Tag>>

/**
 * Scroll reveal — the single place the effect is applied from.
 *
 * All the movement is CSS (`.reveal` / `.reveal-group` / `.reveal-seam` in `index.css`), driven by
 * tokens; this component only owns the `IntersectionObserver` and flips `data-revealed`. That is
 * why there is no `reduced-motion` prop: the tokens already collapse under
 * `prefers-reduced-motion`, and the block lands in its final state with no transition.
 *
 * ```tsx
 * <Reveal as="section" className="py-20">…</Reveal>          // 18px rise, the default
 * <Reveal rise={24} className="rounded-2xl …">…</Reveal>     // heavier block
 * <Reveal as="div" rise="seam" className="seam" aria-hidden />  // hairline, draws from the centre
 *
 * <Reveal group as="ul" className="grid gap-6 md:grid-cols-3">
 *   {tours.map((tour) => (
 *     <li key={tour.id} className="reveal-item">
 *       <TourCard tour={tour} />
 *     </li>
 *   ))}
 * </Reveal>
 * ```
 *
 * Do not nest a `Reveal` inside a revealed `Reveal`: the inner one observes an element that is
 * currently `opacity: 0`, which still intersects, so it would fire early and gain nothing. Reveal
 * the section, then let `group` handle everything inside it.
 */
export function Reveal<Tag extends RevealTag = 'div'>(props: RevealProps<Tag>) {
  const { as, rise = 18, group = false, className = '', style, children, ...rest } = props

  const { ref, revealed } = useReveal<HTMLDivElement>()

  // Every tag in `RevealTag` accepts exactly the DOM props forwarded below, so narrowing the union
  // to one member is enough to type the JSX — and cheaper than a polymorphic generic that would
  // have to re-derive the element's prop shape.
  const Tag = (as ?? 'div') as 'div'

  const variant = group ? 'reveal-group' : rise === 'seam' ? 'reveal-seam' : 'reveal'
  // `--reveal-rise` inherits, which is what lets a `group` container set the distance for all of
  // its items at once.
  const riseStyle =
    typeof rise === 'number' && rise !== 18
      ? ({ '--reveal-rise': `${rise}px` } as CSSProperties)
      : undefined

  return (
    <Tag
      {...(rest as ComponentPropsWithoutRef<'div'>)}
      ref={ref}
      className={className ? `${variant} ${className}` : variant}
      style={riseStyle || style ? { ...riseStyle, ...style } : undefined}
      // Presence is what the CSS matches (`[data-revealed]`); the value is irrelevant.
      data-revealed={revealed ? '' : undefined}
    >
      {children}
    </Tag>
  )
}
