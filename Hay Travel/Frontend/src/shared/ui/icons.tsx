/**
 * Hand-drawn line icons for the public site.
 *
 * Emoji were explicitly rejected by the client, and pulling in an icon font for ~12 glyphs
 * would cost a network request and a flash of unstyled icons. These are plain SVG paths that
 * inherit `currentColor` and the surrounding font size, so they tint with the gold/wine text
 * they sit next to.
 *
 * All icons share one geometry contract: a 24×24 box, 1.5 stroke, round caps/joins — that
 * consistency is what makes a hand-rolled set read as a family rather than clip art.
 */

import type { SVGProps } from 'react'

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  /** Rendered size in px. Defaults to 1em so icons scale with their label. */
  size?: number | string
}

function Icon({ size = '1em', ...props }: IconProps & { children?: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      // Decorative by default: labels next to icons carry the meaning. Callers that use an
      // icon on its own (icon-only button) pass `aria-label` and override this.
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  )
}

/** Excursion marker — a single day, no overnight stay. */
export function SunIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Icon>
  )
}

/** Tour marker — 2+ days, at least one night. */
export function MoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
    </Icon>
  )
}

export function MountainIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2 20h20L14.5 7l-3.2 5.5L9 9Z" />
      <path d="M12.4 12.2 14.5 7" />
    </Icon>
  )
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  )
}

export function MapPinIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </Icon>
  )
}

export function StarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8Z" />
    </Icon>
  )
}

export function TagIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 12.6 12.6 20a2 2 0 0 1-2.8 0l-5.8-5.8a2 2 0 0 1 0-2.8L11.4 4H20Z" />
      <circle cx="16" cy="8" r="1.4" />
    </Icon>
  )
}

/** Guided tour — a person, not a seat. */
export function GuideIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </Icon>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m4.5 12.5 5 5 10-11" />
    </Icon>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  )
}

export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4 2.5 20h19L12 4Z" />
      <path d="M12 10v4M12 17h.01" />
    </Icon>
  )
}

/** Empty state — nothing found yet, go explore. */
export function CompassIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5Z" />
    </Icon>
  )
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </Icon>
  )
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 9.5 6 6 6-6" />
    </Icon>
  )
}

export function HeartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 20s-7-4.4-7-9.5A3.9 3.9 0 0 1 12 7.6a3.9 3.9 0 0 1 7 2.9c0 5.1-7 9.5-7 9.5Z" />
    </Icon>
  )
}

export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  )
}

export function MapIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2Z" />
      <path d="M9 4v14M15 6v14" />
    </Icon>
  )
}
